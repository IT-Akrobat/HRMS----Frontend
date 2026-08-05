import { useEffect, useState } from "react";

const AVATAR_COLORS = [
  "bg-orange-100 text-orange-600",
  "bg-blue-100 text-blue-600",
  "bg-blue-100 text-blue-600",
  "bg-blue-100 text-blue-600",
  "bg-orange-100 text-orange-600",
  "bg-blue-100 text-blue-600",
];

export function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function avatarColor(seed) {
  if (!seed) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash + seed.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
}

/**
 * Shared avatar used across leave, attendance and reports tables.
 * Shows the employee's uploaded profile photo when available,
 * otherwise falls back to a colored circle with their initials.
 *
 * <Avatar name={row.employees?.full_name} photo={row.employees?.profile_photo} />
 */
export default function Avatar({
  name,
  photo,
  size = "w-9 h-9",
  textSize = "text-xs",
  className = "",
}) {
  const [errored, setErrored] = useState(false);

  // Reset the error state if a new photo URL comes in (e.g. after the
  // employee updates their profile photo elsewhere in the app).
  useEffect(() => {
    setErrored(false);
  }, [photo]);

  const showPhoto = Boolean(photo) && !errored;

  if (showPhoto) {
    return (
      <img
        src={photo}
        alt={name || "Employee"}
        onError={() => setErrored(true)}
        className={`${size} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${size} rounded-full flex items-center justify-center font-semibold shrink-0 ${textSize} ${avatarColor(name)} ${className}`}
    >
      {initials(name)}
    </div>
  );
}
