export default function Logo({ compact = false }) {
  if (compact) {
    // Juste l'icône (partie haute du logo, recadrée visuellement)
    return (
      <img
        src="/logo-delt.png"
        alt="DELT AI"
        className="flex-shrink-0"
        style={{ height: 48, width: "auto" }}
      />
    );
  }
  return (
    <img
      src="/logo-delt.png"
      alt="DELT AI"
      className="flex-shrink-0"
      style={{ height: 52, width: "auto" }}
    />
  );
}
