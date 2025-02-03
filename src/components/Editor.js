import React, { useEffect, useRef } from "react";
import { language, cmtheme } from "../../src/atoms";
import { useRecoilValue } from "recoil";
import ACTIONS from "../actions/Actions";
import axios from "axios";
import io from "socket.io-client";

// CODE MIRROR
import Codemirror from "codemirror";
import "codemirror/lib/codemirror.css";

// Themes
import "codemirror/theme/dracula.css";
import "codemirror/theme/monokai.css";
import "codemirror/theme/material.css";

// Modes (Programming Languages)
import "codemirror/mode/javascript/javascript";
import "codemirror/mode/python/python";
import "codemirror/mode/java/java";
import "codemirror/mode/htmlmixed/htmlmixed";
import "codemirror/mode/xml/xml";
import "codemirror/mode/css/css";
import "codemirror/mode/sql/sql";

// Features
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";

// AI Autocomplete Function
async function getAISuggestions(codeSnippet) {
    try {
        const response = await axios.post("http://localhost:8080/v1/completions", {
            prompt: codeSnippet,
        });
        return response.data.choices[0].text;
    } catch (error) {
        console.error("Error fetching AI suggestions:", error);
        return "";
    }
}

const Editor = ({ socketRef, roomId, onCodeChange }) => {
    const editorRef = useRef(null);
    const lang = useRecoilValue(language);
    const editorTheme = useRecoilValue(cmtheme);

    useEffect(() => {
        async function init() {
            editorRef.current = Codemirror.fromTextArea(document.getElementById("realtimeEditor"), {
                mode: { name: lang },
                theme: editorTheme,
                autoCloseTags: true,
                autoCloseBrackets: true,
                lineNumbers: true,
            });

            editorRef.current.on("change", async (instance, changes) => {
                const { origin } = changes;
                const code = instance.getValue();
                onCodeChange(code);

                // Emit code change event for real-time collaboration
                if (origin !== "setValue") {
                    socketRef.current.emit(ACTIONS.CODE_CHANGE, { roomId, code });
                }

                // AI Autocompletion (Trigger on user input)
                if (origin === "+input") {
                    const aiSuggestion = await getAISuggestions(code);
                    if (aiSuggestion) {
                        instance.replaceRange(aiSuggestion, instance.getCursor());
                    }
                }
            });
        }
        init();
    }, [lang]);

    useEffect(() => {
        if (socketRef.current) {
            socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
                if (code !== null && code !== editorRef.current.getValue()) {
                    editorRef.current.setValue(code);
                }
            });
        }

        return () => {
            socketRef.current.off(ACTIONS.CODE_CHANGE);
        };
    }, [socketRef.current]);

    return <textarea id="realtimeEditor"></textarea>;
};

export default Editor;
