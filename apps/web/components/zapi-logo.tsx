export function ZapiLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="zapi-bolt"
          x1="232"
          x2="829"
          y1="263"
          y2="806"
        >
          <stop offset="0" stopColor="#1d9ff0" />
          <stop offset="0.55" stopColor="#84d0f2" />
          <stop offset="1" stopColor="#e5fbff" />
        </linearGradient>
      </defs>
      <rect fill="#050505" height="1024" rx="184" width="1024" />
      <path
        d="M373.8 150.2a15.6 15.6 0 0 1 19.2-1.2l326.8 232.5a15.6 15.6 0 0 1 2.9 22.8L520.8 626.2a15.6 15.6 0 0 0 3.2 23.5l323.7 206.7a4.1 4.1 0 0 1-2.9 7.5L253.3 745.5a15.6 15.6 0 0 1-9.3-25.1L467.5 449a15.6 15.6 0 0 0-2.4-22.2L265.7 275.5a15.6 15.6 0 0 1-1.5-23.6z"
        fill="url(#zapi-bolt)"
      />
    </svg>
  )
}
