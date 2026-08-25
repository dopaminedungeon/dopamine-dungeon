import { Check } from "lucide-react";

export default function PasswordRequirements({ requirements }) {
  if (requirements.length === 0) return null;

  return (
    <ul className="grid gap-[8px] text-[clamp(14px,0.875rem,18px)] leading-[1.4] text-zinc-400" aria-label="Password requirements">
      {requirements.map((requirement) => (
        <li key={requirement.key} className="flex items-center gap-2">
          <Check className={`h-[16px] w-[16px] shrink-0 ${requirement.met ? "text-emerald-400" : "text-zinc-600"}`} aria-hidden="true" />
          {requirement.label}
        </li>
      ))}
    </ul>
  );
}
