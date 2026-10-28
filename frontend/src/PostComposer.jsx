import { useEffect, useState } from "react";
import { ImagePlus, Video, X } from "lucide-react";
import { apiRequest } from "./services/api.js";

const IMAGE_LIMIT = 10 * 1024 * 1024;
const VIDEO_LIMIT = 100 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm"];

export default function PostComposer({ onClose, onPublished }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function chooseFile(event) {
    const selected = event.target.files?.[0] || null;
    event.target.value = "";
    setError("");
    if (!selected) return;
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setFile(null);
      setError("Choose a JPG, PNG, GIF, WebP, MP4, or WebM file.");
      return;
    }
    const limit = selected.type.startsWith("image/") ? IMAGE_LIMIT : VIDEO_LIMIT;
    if (selected.size > limit) {
      setFile(null);
      setError(selected.type.startsWith("image/")
        ? "Images must be 10 MB or smaller."
        : "Videos must be 100 MB or smaller.");
      return;
    }
    setFile(selected);
  }

  async function submit(event) {
    event.preventDefault();
    if (publishing) return;
    if (!text.trim() && !file) {
      setError("Write something or choose a photo or video to share.");
      return;
    }
    setPublishing(true);
    setError("");
    try {
      const body = new FormData();
      body.append("text", text.trim());
      if (file) body.append("media", file);
      const data = await apiRequest("/api/posts", { method: "POST", body });
      onPublished(data.post);
    } catch (requestError) {
      setError(requestError.message || "We couldn't publish your post. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4">
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-post-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="create-post-title" className="text-xl font-extrabold">Create a post</h2>
            <p className="mt-1 text-sm text-slate-500">Share an update with your campus community.</p>
          </div>
          <button type="button" onClick={onClose} disabled={publishing} aria-label="Close post composer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            <X size={20} />
          </button>
        </div>
        <label className="mt-5 block">
          <span className="sr-only">Post text</span>
          <textarea
            autoFocus
            maxLength={2000}
            rows={5}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What's happening on campus?"
            className="w-full resize-y rounded-xl border border-slate-200 p-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <span className="mt-1 block text-right text-xs text-slate-400">{text.length}/2000</span>
        </label>
        {previewUrl && file && (
          <div className="relative mt-3 overflow-hidden rounded-xl border border-slate-200">
            {file.type.startsWith("video/")
              ? <video src={previewUrl} controls className="max-h-72 w-full bg-black object-contain" />
              : <img src={previewUrl} alt="Selected post preview" className="max-h-72 w-full object-contain" />}
            <button type="button" onClick={() => setFile(null)} aria-label="Remove selected media" disabled={publishing} className="absolute right-2 top-2 rounded-full bg-white p-2 text-slate-700 shadow hover:bg-slate-100">
              <X size={16} />
            </button>
          </div>
        )}
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {file?.type.startsWith("video/") ? <Video size={18} /> : <ImagePlus size={18} />}
            Add photo or video
            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm" onChange={chooseFile} disabled={publishing} className="sr-only" />
          </label>
          <span className="text-xs text-slate-400">Images up to 10 MB · videos up to 100 MB</span>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={publishing} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={publishing} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
            {publishing ? "Publishing..." : "Publish post"}
          </button>
        </div>
      </form>
    </div>
  );
}
