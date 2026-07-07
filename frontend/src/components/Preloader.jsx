export default function Preloader({ label = 'Loading…' }) {
  return (
    <div className="preloader-wrap flex flex-col items-center justify-center py-24 gap-3">
      <img src="/logo.png" alt="" className="w-10 h-10 rounded-lg preloader-mark" />
      <span className="spinner text-google-blue text-xl" />
      <p className="text-xs text-gray-400 tracking-wide">{label}</p>
    </div>
  );
}
