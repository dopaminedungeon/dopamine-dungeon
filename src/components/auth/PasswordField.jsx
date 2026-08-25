import { Eye, EyeOff, LockKeyhole } from "lucide-react";

export default function PasswordField({
  id,
  label,
  name,
  autoComplete,
  value,
  onChange,
  visible,
  onToggleVisibility,
  visibilityLabel,
}) {
  const toggleLabel = `${visible ? "Hide" : "Show"} ${visibilityLabel}`;

  return (
    <div>
      <label htmlFor={id} className="block text-[clamp(16px,1.0625rem,22px)] leading-[1.4] font-medium text-zinc-200">
        {label}
      </label>
      <div className="relative mt-[10px]">
        <LockKeyhole className="pointer-events-none absolute left-[16px] top-1/2 h-[22px] w-[22px] -translate-y-1/2 text-zinc-500" aria-hidden="true" />
        <input
          id={id}
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={onChange}
          className="h-[56px] w-full rounded-md border border-zinc-700 bg-zinc-950 pl-[52px] pr-[60px] text-[clamp(16px,1rem,20px)] text-white outline-none transition focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute right-[6px] top-1/2 flex h-[44px] w-[44px] -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 hover:text-white focus-visible:outline-2 focus-visible:outline-purple-300"
          aria-label={toggleLabel}
          aria-pressed={visible}
          title={toggleLabel}
        >
          {visible ? <EyeOff className="h-[22px] w-[22px]" aria-hidden="true" /> : <Eye className="h-[22px] w-[22px]" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
