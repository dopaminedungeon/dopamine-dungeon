import React from "react";

export default function ProgressTrack({ value = 0, onChange, label = "Progress", ariaLabel = `${label} progress` }) {
  const progress = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className="space-y-2">
    <div className="flex justify-between text-xs text-zinc-400"><span>{label}</span><span>{progress}%</span></div>
    <div className="relative h-3 rounded-full bg-zinc-800" {...(!onChange ? { role: "progressbar", "aria-label": ariaLabel, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": progress } : {})}>
      <span data-testid="quest-progress-fill" aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full"
        style={{ backgroundImage: "linear-gradient(90deg, #a855f7, #f472b6 35%, #0ea5e9 70%, #2dd4bf)", clipPath: `inset(0 ${100 - progress}% 0 0)` }} />
      {onChange && <input aria-label={`Set ${label.toLowerCase()}`} aria-valuetext={`${progress}%`} type="range" min="0" max="100" value={progress}
        onChange={(event) => onChange(Number(event.target.value))}
        className="absolute inset-0 block h-3 w-full cursor-pointer appearance-none rounded-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-purple-300 [&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-purple-500 [&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-purple-500" />}
    </div>
  </div>;
}
