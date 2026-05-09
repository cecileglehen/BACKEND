export default function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "#0f172a" }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
          <path d="M12 4 L20 20 H4 Z" fill="white" />
          <circle cx="12" cy="15" r="2" fill="#6366f1" />
        </svg>
      </div>
      {!compact && (
        <div>
          <span className="font-bold text-base tracking-tight text-delt-text">DELT AI</span>
        </div>
      )}
    </div>
  );
}
