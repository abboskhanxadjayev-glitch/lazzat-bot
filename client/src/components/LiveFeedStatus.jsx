import { formatLastUpdated } from "../hooks/useLiveList";

const MODE_LABELS = {
  connecting: "Ulanmoqda",
  realtime: "Realtime",
  polling: "Auto 5s"
};

function LiveFeedStatus({ liveMode, lastUpdatedAt }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-lazzat-ink/65">
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-bold uppercase tracking-[0.18em] text-emerald-700">
        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" />
        Live
      </span>
      <span className="font-semibold text-lazzat-maroon/80">{MODE_LABELS[liveMode] || MODE_LABELS.polling}</span>
      <span>Oxirgi yangilanish: {formatLastUpdated(lastUpdatedAt)}</span>
    </div>
  );
}

export default LiveFeedStatus;
