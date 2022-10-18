import {
  Button,
  Checkbox,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Select,
} from "@chakra-ui/react";
import { X } from "phosphor-react";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const PromptEditorContext = createContext<{
  open: boolean;
  currentPrompt: string;
  setCurrentPrompt: (val: string | ((prev: string) => string)) => void;
  openEditor: (content: string) => void;
  closeEditor: () => void;
} | null>(null);

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8935";

function saveCaretPosition(context: any, plusOne?: boolean) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount < 1) return;
  const selection = sel;
  const range = selection.getRangeAt(0);
  if (!range) return;
  range.setStart(context, 0);
  const len = range.toString().length;

  return function restore() {
    try {
      const pos = getTextNodeAtPosition(context, len);
      selection.removeAllRanges();
      const range = new Range();
      range.setStart(pos.node, pos.position + (plusOne ? 1 : 0));
      selection.addRange(range);
    } catch (e) {
      // pass
    }
  };
}

function getTextNodeAtPosition(root: any, index: any) {
  const NODE_TYPE = NodeFilter.SHOW_TEXT;
  const treeWalker = document.createTreeWalker(root, NODE_TYPE, function next(elem: any) {
    if (index > elem?.textContent?.length) {
      index -= elem?.textContent?.length;
      return NodeFilter.FILTER_REJECT;
    }
    return NodeFilter.FILTER_ACCEPT;
  });
  const c = treeWalker.nextNode();
  return {
    node: c ? c : root,
    position: index,
  };
}

export const PromptEditorProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState("");

  const openEditor = useCallback(content => {
    setOpen(true);
    setCurrentPrompt(content);
  }, []);
  const closeEditor = useCallback(() => setOpen(false), []);

  return (
    <PromptEditorContext.Provider
      value={{
        open,
        currentPrompt,
        setCurrentPrompt,
        openEditor,
        closeEditor,
      }}
    >
      {children}
    </PromptEditorContext.Provider>
  );
};

export const usePromptEditorContext = () => {
  const context = useContext(PromptEditorContext);
  if (!context)
    throw new Error("usePromptEditorContext must be used within a PromptEditorProvider");
  return context;
};

export const ClassifyOptions = ({
  options,
  setOptions,
}: {
  options: string[];
  setOptions: (opts: string[]) => void;
}) => {
  const [val, setVal] = useState("");

  return (
    <>
      <h3 className="text-lg font-semibold text-gray-700 mb-2 mt-3">Options</h3>
      <div className="flex gap-2">
        {options.map(opt => (
          <div className="bg-gray-200 rounded-8 pl-3 pr-2 my-2 flex items-center" key={opt}>
            {opt}
            <span className="rounded-full bg-gray-300 text-white ml-2 inline-flex">
              <X
                className="inline-block"
                onClick={() => {
                  setOptions(options.filter(el => el !== opt));
                }}
              />
            </span>
          </div>
        ))}
        <input
          value={val}
          onChange={ev => setVal(ev.target.value)}
          type="text"
          placeholder="Enter an option, then press 'Enter' to add"
          className="flex-grow border-slate-200 border px-3 py-2 block rounded-4 shadow-sm focus:border-blue-600 focus:ring-blue-600"
          onKeyUp={ev => {
            if (ev.key === "Enter") {
              setOptions([...options, val]);
              setVal("");
            }
          }}
        />
      </div>
    </>
  );
};

export const ClassifyResults = ({
  options,
  results,
}: {
  options: string[];
  results: Record<string, number>;
}) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2 mt-3">Results</h3>
      <div className="flex flex-col gap-1">
        {options.map(opt => (
          <div className="flex" key={opt}>
            <span className="text-gray-700 mr-2">{opt}</span>
            <div className="border border-slate-200 rounded-4 flex-grow mr-2">
              <span
                className="bg-gray-700 rounded-4 block h-full"
                style={{ width: `calc(100% * ${results[opt] || 0})` }}
              />
            </div>
            <span className="text-gray-700 w-16">
              {results[opt] !== undefined ? Math.round(results[opt] * 10000) / 100 : "..."}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const PromptEditorModal = () => {
  const { open, currentPrompt, setCurrentPrompt, closeEditor } = usePromptEditorContext();
  const promptBoxRef = useRef<HTMLDivElement | null>(null);
  const promptContentRef = useRef<HTMLDivElement | null>(null);

  const [keepResults, setKeepResults] = useState(true);

  const [promptResult, setPromptResult] = useState("");
  const [loading, setLoading] = useState(false);

  const [agents, setAgents] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>();
  const [task, setTask] = useState("complete");
  const [multiline, setMultiline] = useState(false);
  const [classifyOptions, setClassifyOptions] = useState<string[]>([]);
  const [classifyResults, setClassifyResults] = useState<Record<string, number>>({});
  useEffect(() => {
    fetch(`${backendUrl}/agents/list`)
      .then(res => res.json())
      .then(agents => {
        setAgents(agents);
        setSelectedAgent(agents[0]);
      });
  }, []);

  useEffect(() => {
    if (!open) return () => false;

    const closeOnEscape = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        closeEditor();
      }
    };

    document.addEventListener("keyup", closeOnEscape);
    return () => document.removeEventListener("keyup", closeOnEscape);
  }, [open, closeEditor]);

  useEffect(() => {
    if (!promptContentRef.current || !promptResult.length) return;
    const span = document.createElement("span");
    span.id = "promptResult";
    span.style.backgroundColor = "skyblue";
    span.appendChild(document.createTextNode(promptResult));
    const oldSpan = document.getElementById("promptResult");
    if (!oldSpan) promptContentRef.current.appendChild(span);
    else promptContentRef.current.replaceChild(span, oldSpan);
  }, [promptResult]);

  const handleInput = useCallback(
    (ev: any) => {
      if (!keepResults) {
        const oldSpan = document.getElementById("promptResult");
        if (oldSpan) promptContentRef.current?.removeChild(oldSpan);
      }
      setCurrentPrompt((ev.target as HTMLSpanElement).innerText || "");
      setPromptResult("");
    },
    [setCurrentPrompt, keepResults],
  );

  useEffect(() => {
    if (!promptContentRef.current) return;
    const restore = saveCaretPosition(promptContentRef.current, currentPrompt.endsWith("\n"));
    promptContentRef.current.textContent = currentPrompt;
    if (restore) restore();
  }, [currentPrompt]);

  return (
    <div
      className={`${
        open ? "flex" : "hidden"
      } h-screen w-screen absolute top-0 left-0 bg-gray-200 bg-opacity-50 z-50 justify-center items-center cursor-pointer`}
      onClick={ev => {
        if (!promptBoxRef.current?.contains(ev.target as Node)) {
          closeEditor();
        }
      }}
    >
      <div
        className="rounded-4 px-6 py-4 bg-white h-2/3 w-2/3 shadow cursor-default flex"
        ref={promptBoxRef}
      >
        <div className="flex flex-col w-full">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Prompt</h3>
          <div
            className="rounded-4 flex-grow border-slate-200 border px-3 py-2 whitespace-pre-wrap w-full overflow-auto"
            contentEditable
            onInput={ev => handleInput(ev)}
            onKeyDown={ev => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                ev.stopPropagation();
                document.execCommand("insertLineBreak");
              }
            }}
            ref={promptContentRef}
          />
          {task === "classify" ? (
            <ClassifyOptions options={classifyOptions} setOptions={setClassifyOptions} />
          ) : null}
          {task === "classify" ? (
            <ClassifyResults options={classifyOptions} results={classifyResults} />
          ) : null}
        </div>
        <div className="flex flex-col w-48 pl-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Agent</h3>
          <label className="text-sm mb-1 text-gray-600">Model</label>
          <Select onChange={ev => setSelectedAgent(ev.target.value)} value={selectedAgent}>
            {agents.map(el => (
              <option key={el} value={el}>
                {el}
              </option>
            ))}
          </Select>
          <label className="text-sm mb-1 mt-3 text-gray-600">Task</label>
          <Select onChange={ev => setTask(ev.target.value)} value={task}>
            <option value="complete">Complete</option>
            <option value="classify">Classify</option>
          </Select>
          <label className="text-sm mb-1 mt-3 text-gray-600">Multiline</label>
          <Checkbox isChecked={multiline} onChange={ev => setMultiline(ev.target.checked)} />
          <div className="flex-grow"></div>
          <label className="text-sm mb-1 mt-3 text-gray-600">Keep prompt results</label>
          <Checkbox isChecked={keepResults} onChange={ev => setKeepResults(ev.target.checked)} />
          <div>
            <Button
              aria-label="prompt language model"
              className="rounded-4 px-2 py-1 h-fit !shadow-none hover:bg-slate-200 mt-4 text-xs"
              size="md"
              variant="outline"
              onClick={() => {
                setLoading(true);
                fetch(`${backendUrl}/agents/${task}`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-Api-Key": process.env.NEXT_PUBLIC_BACKEND_API_KEY ?? "",
                  },
                  body: JSON.stringify({
                    agent: selectedAgent,
                    prompt: currentPrompt,
                    options: task === "classify" ? classifyOptions : undefined,
                    multiline: task === "complete" ? multiline : undefined,
                  }),
                })
                  .then(res => res.json())
                  .then(data => {
                    setClassifyResults(data);
                    setLoading(false);
                  });
              }}
            >
              {loading ? "Loading..." : "Prompt model"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
