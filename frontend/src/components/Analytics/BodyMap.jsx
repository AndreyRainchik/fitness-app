import React from 'react';

/*
 * Front and back anatomical figures for the weekly muscle map.
 *
 * Coordinates are for a 200 × 440 figure centred on x = 100. Every shape is
 * drawn for the viewer's left half only and mirrored, which keeps the body
 * symmetric. Region names match the exercises' muscle groups in the API.
 */

const MIRROR = 'matrix(-1 0 0 1 200 0)';

/** Outline of half the body (head to toe), shared by both views. */
const SILHOUETTE = `
  M100,8 C88,8 81,17 81,31 C81,41 85,49 91,54 L91,62
  C84,67 74,69 62,71 C50,73 42,80 40,92 C38,104 37,118 36,130
  C35,145 34,155 33,165 C30,180 27,200 25,222 C24,230 22,238 20,246
  C18,254 19,264 24,268 C29,270 31,262 32,254 C33,246 35,238 37,230
  C41,212 45,192 48,172 C50,160 53,146 55,134 C56,126 57,118 58,112
  C59,124 61,136 62,148 C64,162 66,174 66,186 C64,198 62,210 62,224
  C61,250 62,280 66,300 C67,312 65,326 64,340 C62,360 66,380 70,394
  L70,410 C66,416 63,424 72,426 L92,426 C94,420 92,412 90,406
  L88,394 C90,374 92,350 90,330 C89,318 90,308 92,298
  C96,272 98,246 100,226 Z`;

/** Front view: muscle regions (left half). */
const FRONT = [
  { group: 'Shoulders', d: 'M64,72 C52,73 43,80 41,92 C40,102 40,110 42,116 C46,108 51,101 57,97 C62,90 67,82 72,76 Z' },
  { group: 'Chest', d: 'M98,77 L98,115 C90,120 77,120 67,114 C62,109 59,102 59,98 C63,89 69,81 75,77 C83,74 91,74 98,77 Z' },
  { group: 'Biceps', d: 'M43,120 C41,132 40,146 42,159 C45,164 50,162 52,154 C54,141 55,128 55,118 C51,111 46,113 43,120 Z' },
  { group: 'Forearms', d: 'M37,170 C34,186 31,204 28,224 C31,229 35,229 37,226 C41,210 45,192 48,174 C45,166 40,165 37,170 Z' },
  { group: 'Core', d: 'M98,121 L98,206 C93,212 87,214 82,210 C80,190 78,160 78,123 C86,121 92,120 98,121 Z' },
  { group: 'Core', d: 'M75,123 C69,124 64,130 63,139 C64,158 66,174 67,186 C70,196 75,203 79,208 C77,180 75,150 75,123 Z' },
  { group: 'Quadriceps', d: 'M64,226 C60,248 61,272 66,292 C70,302 78,306 84,304 C90,300 94,290 95,276 C96,262 97,248 97,236 C90,229 78,223 64,226 Z' },
  { group: 'Calves', d: 'M67,318 C64,338 65,360 70,384 C74,387 77,385 78,380 C79,360 79,338 77,320 C74,315 70,315 67,318 Z' },
  { group: 'Calves', d: 'M89,321 C91,340 90,360 87,380 C84,383 82,381 81,377 C81,356 82,338 83,322 C85,318 88,318 89,321 Z' },
];

/** Front view: non-interactive definition lines (abs, pecs, quads, knees). */
const FRONT_LINES = [
  'M80,140 C86,142 93,142 98,140',
  'M80,160 C86,162 93,162 98,160',
  'M80,180 C86,182 93,182 98,180',
  'M73,236 C76,258 78,280 79,302',
  'M85,264 C90,274 92,288 88,301',
  'M70,312 C76,318 84,318 89,312',
  'M93,58 C95,64 98,70 99,76',
];

/** Back view: muscle regions (left half). */
const BACK = [
  { group: 'Back', d: 'M98,58 L98,128 C92,120 85,106 79,94 C75,86 69,78 63,73 C74,69 85,64 92,58 Z' },
  { group: 'Shoulders', d: 'M62,73 C51,74 43,81 41,92 C40,102 40,108 42,113 C48,106 55,100 62,96 C67,90 72,84 76,80 C72,77 67,74 62,73 Z' },
  { group: 'Back', d: 'M78,97 C84,109 91,121 98,132 L98,180 C92,186 86,190 80,190 C76,180 70,166 64,150 C61,138 61,118 64,108 C68,101 73,97 78,97 Z' },
  { group: 'Back', d: 'M98,184 L98,212 C90,214 81,211 73,205 C71,199 73,195 78,193 C86,193 92,190 98,184 Z' },
  { group: 'Triceps', d: 'M42,117 C39,130 39,144 41,156 C44,162 50,161 53,153 C55,138 56,124 56,112 C52,106 46,109 42,117 Z' },
  { group: 'Forearms', d: 'M37,170 C34,186 31,204 28,224 C31,229 35,229 37,226 C41,210 45,192 48,174 C45,166 40,165 37,170 Z' },
  { group: 'Glutes', d: 'M98,216 L98,262 C88,268 75,266 67,257 C63,245 62,232 64,221 C74,217 86,215 98,216 Z' },
  { group: 'Hamstrings', d: 'M66,263 C63,280 65,298 70,310 C76,316 88,316 94,308 C97,294 98,280 98,267 C88,272 76,270 66,263 Z' },
  { group: 'Calves', d: 'M67,322 C62,336 63,352 68,366 C72,374 80,378 86,374 C92,366 93,348 90,332 C88,324 84,320 79,320 C74,318 70,318 67,322 Z' },
];

/** Back view: definition lines (spine, hamstring split, calf heads). */
const BACK_LINES = [
  'M100,62 L100,212',
  'M82,271 C82,286 82,300 82,312',
  'M79,324 C79,340 79,356 80,374',
];

function Figure({ regions, lines, label, fillFor, active, onHover }) {
  const renderHalf = (transform) => (
    <g transform={transform}>
      {regions.map((r, i) => (
        <path
          key={i}
          d={r.d}
          fill={fillFor(r.group)}
          stroke="rgb(var(--surface))"
          strokeWidth="1.6"
          strokeLinejoin="round"
          className="cursor-pointer transition-[fill,opacity] duration-200"
          opacity={active && active !== r.group ? 0.55 : 1}
          onMouseEnter={() => onHover(r.group)}
          onMouseLeave={() => onHover(null)}
          onClick={() => onHover(active === r.group ? null : r.group)}
        >
          <title>{r.group}</title>
        </path>
      ))}
      <g fill="none" stroke="rgb(var(--surface))" strokeWidth="1.3" strokeLinecap="round" pointerEvents="none">
        {lines.map((d, i) => <path key={i} d={d} />)}
      </g>
    </g>
  );

  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 200 440" className="h-[300px] w-auto sm:h-[380px]" role="img" aria-label={`${label} view muscle map`}>
        <g fill="rgb(var(--gray-200))">
          <path d={SILHOUETTE} />
          <path d={SILHOUETTE} transform={MIRROR} />
        </g>
        {renderHalf(undefined)}
        {renderHalf(MIRROR)}
      </svg>
      <figcaption className="eyebrow mt-2">{label}</figcaption>
    </figure>
  );
}

/**
 * Front and back figures side by side.
 * - fillFor(group): fill color for a muscle group
 * - active: hovered/selected group (others dim)
 * - onHover(group | null)
 */
function BodyMap({ fillFor, active, onHover }) {
  return (
    <div className="flex items-start justify-center gap-2 sm:gap-10">
      <Figure regions={FRONT} lines={FRONT_LINES} label="Front" fillFor={fillFor} active={active} onHover={onHover} />
      <Figure regions={BACK} lines={BACK_LINES} label="Back" fillFor={fillFor} active={active} onHover={onHover} />
    </div>
  );
}

export default BodyMap;
