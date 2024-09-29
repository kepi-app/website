import { useFetcher } from "@remix-run/react";
import dayjs from "dayjs";
import { useEffect, useRef } from "react";
import { MainEditor, type MainEditorRef } from "~/blog-post-editor/main-editor";
import {
    useEditorStore,
    useEditorStoreContext
} from "~/blog-post-editor/store";
import { BottomArea } from "~/blog-post-editor/bottom-area";
import type { MultiUploadResult } from "~/blog/upload";
import { PostUpdate } from "./blogs.$blogSlug.posts.$postSlug";

export function EditBlogPostPage() {
    const postUpdate = useRef<PostUpdate>({});
    const autoSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mainEditorRef = useRef<MainEditorRef | null>(null);
    const setStatusMessage = useEditorStore((state) => state.setStatusMessage);
    const setIsFocused = useEditorStore((state) => state.setIsFocused);
    const clearPendingFiles = useEditorStore((state) => state.clearPendingFiles);
    const insertUploadedImages = useEditorStore(
        (state) => state.insertUploadedImages
    );
    const editorStore = useEditorStoreContext();

    const fetcher = useFetcher();
    const uploadFetcher = useFetcher<MultiUploadResult>();

    useEffect(
        function unfocusOnMouseMove() {
            function unfocus() {
                if (editorStore.getState().canUnfocus) {
                    setIsFocused(false);
                }
            }
            document.addEventListener("mousemove", unfocus);
            return () => {
                document.removeEventListener("mousemove", unfocus);
            };
        },
        [setIsFocused, editorStore.getState]
    );

    useEffect(
        function updateStatusMessage() {
            switch (fetcher.state) {
                case "idle":
                    if (editorStore.getState().statusMessage) {
                        setStatusMessage(`Last saved ${dayjs().fromNow()}`);
                    }
                    break;

                case "loading":
                    break;

                case "submitting":
                    setStatusMessage("Saving…");
                    break;
            }
        },
        [setStatusMessage, fetcher.state, editorStore.getState]
    );

    useEffect(() => {
        if (uploadFetcher.state === "idle") {
            clearPendingFiles();
        }
    }, [clearPendingFiles, uploadFetcher.state]);

    useEffect(() => {
        if (!uploadFetcher.data) {
            return;
        }

        const contentInput = mainEditorRef?.current?.contentInput;
        if (!contentInput) {
            return;
        }

        insertUploadedImages(uploadFetcher.data, contentInput.selectionEnd);
    }, [uploadFetcher.data]);

    useEffect(
        function autoSaveOnContentChange() {
            const unsub0 = editorStore.subscribe(
                (state) => state.content,
                (content) => {
                    postUpdate.current.content = content;
                    autoSaveAfterTimeout();
                }
            );
            const unsub1 = editorStore.subscribe(
                (state) => state.title,
                (title) => {
                    postUpdate.current.title = title;
                    autoSaveAfterTimeout();
                }
            );
            const unsub2 = editorStore.subscribe(
                (state) => state.description,
                (description) => {
                    postUpdate.current.description = description;
                    autoSaveAfterTimeout();
                }
            );
            return () => {
                unsub0();
                unsub1();
                unsub2();
            };
        },
        [editorStore.subscribe]
    );

    useEffect(() => {
        const unsub = editorStore.subscribe(
            (state) => state.pendingFiles,
            (files) => {
                if (files.length === 0) {
                    return;
                }
                const form = new FormData();
                for (const file of files) {
                    form.append("images", file);
                }
                uploadFetcher.submit(form, {
                    encType: "multipart/form-data",
                    method: "POST",
                    action: "./image",
                });
            }
        );
        return () => {
            unsub();
        };
    }, [uploadFetcher.submit, editorStore.subscribe]);

    useEffect(() => {
        return () => {
            if (autoSaveTimeout.current) {
                clearTimeout(autoSaveTimeout.current);
            }
        };
    }, []);

    function autoSaveAfterTimeout() {
        if (autoSaveTimeout.current) {
            clearTimeout(autoSaveTimeout.current);
        }
        autoSaveTimeout.current = setTimeout(savePost, 2000);
    }

    function savePost() {
        fetcher.submit(postUpdate.current as Record<string, string>, {
            method: "PATCH",
            encType: "application/json",
        });
        postUpdate.current = {};
        autoSaveTimeout.current = null;
    }

    return (
        <div className="w-full px-16 flex justify-center">
            <main className="w-full mt-40 lg:max-w-prose">
                <MainEditor ref={mainEditorRef} />
                <BottomArea />
            </main>
        </div>
    );
}

