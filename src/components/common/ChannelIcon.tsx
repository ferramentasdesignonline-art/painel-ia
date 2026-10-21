import React from 'react';

interface ChannelIconProps {
  canal?: string | null;
  label?: string | null;
  className?: string;
}

export function ChannelIcon({ canal, label, className = "w-3.5 h-3.5 shrink-0" }: ChannelIconProps) {
  const norm = (label || canal || '').toLowerCase();

  // Meta Ads / Meta
  if (norm.includes('meta') || norm === 'meta_ads') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Meta">
        <path
          d="M16.92 5C14.77 5 13.25 6.22 12 7.78C10.75 6.22 9.23 5 7.08 5C3.72 5 1 7.72 1 11.08C1 15.34 4.54 18.57 9.06 18.96C9.69 19.01 10.28 18.66 10.5 18.06L11.53 15.17C11.66 14.81 12 14.56 12.39 14.56C12.78 14.56 13.12 14.81 13.25 15.17L14.28 18.06C14.5 18.66 15.09 19.01 15.72 18.96C20.24 18.57 23.78 15.34 23.78 11.08C23.78 7.72 21.06 5 17.7 5H16.92ZM7.08 16.08C4.83 16.08 3 14.25 3 12C3 9.75 4.83 7.92 7.08 7.92C9.02 7.92 10.42 9.38 11.23 10.74C10.42 12.1 9.02 16.08 7.08 16.08ZM16.92 16.08C14.98 16.08 13.58 12.1 12.77 10.74C13.58 9.38 14.98 7.92 16.92 7.92C19.17 7.92 21 9.75 21 12C21 14.25 19.17 16.08 16.92 16.08Z"
          fill="#0081FB"
        />
      </svg>
    );
  }

  // Instagram
  if (norm.includes('insta') || norm === 'instagram_ads') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Instagram">
        <defs>
          <radialGradient id="ig-grad" cx="20%" cy="105%" r="120%">
            <stop offset="0%" stopColor="#fdf497" />
            <stop offset="5%" stopColor="#fdf497" />
            <stop offset="45%" stopColor="#fd5949" />
            <stop offset="60%" stopColor="#d6249f" />
            <stop offset="90%" stopColor="#285AEB" />
          </radialGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig-grad)" />
        <circle cx="12" cy="12" r="4.5" stroke="#ffffff" strokeWidth="2" fill="none" />
        <circle cx="17.5" cy="6.5" r="1.2" fill="#ffffff" />
      </svg>
    );
  }

  // Facebook (Ads / Marketplace)
  if (norm.includes('face') || norm === 'facebook_ads' || norm === 'facebook_marketplace') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Facebook">
        <rect width="24" height="24" rx="12" fill="#1877F2" />
        <path
          d="M15.5 13.25L16 9.75H12.5V7.75C12.5 6.8 12.95 6 14.25 6H16V3.15C15.2 3.05 14.2 3 13.2 3C10.75 3 9 4.6 9 7.45V9.75H6V13.25H9V21.5C9.7 21.6 10.3 21.7 11 21.7C11.7 21.7 12.3 21.6 13 21.5V13.25H15.5Z"
          fill="white"
        />
      </svg>
    );
  }

  // Google Ads / Google Meu Negócio
  if (norm.includes('goog') || norm === 'google_ads') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-label="Google">
        <path
          fill="#4285F4"
          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
        />
      </svg>
    );
  }

  // WhatsApp
  if (norm.includes('whats') || norm === 'whatsapp') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="WhatsApp">
        <rect width="24" height="24" rx="12" fill="#25D366" />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 4C7.58 4 4 7.58 4 12C4 13.52 4.43 14.94 5.17 16.15L4.2 19.8L7.96 18.85C9.13 19.54 10.52 19.95 12 19.95C16.42 19.95 20 16.37 20 11.95C20 7.53 16.42 4 12 4ZM15.93 14.83C15.77 15.28 15.11 15.65 14.61 15.76C14.27 15.83 13.82 15.89 12.33 15.27C10.42 14.48 9.18 12.54 9.09 12.41C8.99 12.28 8.32 11.39 8.32 10.46C8.32 9.53 8.79 9.08 8.98 8.89C9.14 8.73 9.4 8.65 9.62 8.65C9.69 8.65 9.76 8.65 9.82 8.65C10 8.66 10.09 8.67 10.2 8.93C10.34 9.27 10.68 10.1 10.72 10.19C10.76 10.27 10.8 10.38 10.75 10.49C10.7 10.6 10.65 10.68 10.57 10.77C10.49 10.86 10.4 10.97 10.33 11.04C10.24 11.13 10.15 11.23 10.25 11.4C10.35 11.58 10.7 12.14 11.21 12.6C11.87 13.19 12.41 13.38 12.61 13.46C12.77 13.53 12.96 13.51 13.08 13.38C13.23 13.22 13.42 12.95 13.61 12.68C13.75 12.48 13.93 12.5 14.09 12.56C14.25 12.62 15.29 13.13 15.5 13.24C15.71 13.35 15.85 13.4 15.9 13.49C15.95 13.58 15.95 14.05 15.93 14.83Z"
          fill="white"
        />
      </svg>
    );
  }

  // Mercado Livre
  if (norm.includes('mercado') || norm === 'mercado_livre') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Mercado Livre">
        <rect width="24" height="24" rx="6" fill="#FFE600" />
        <path
          d="M6 13.5C6.8 12 8.5 11.5 10 12.5L12 14L14 12.5C15.5 11.5 17.2 12 18 13.5M7 15L9.5 17M17 15L14.5 17"
          stroke="#2D3277"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Webmotors
  if (norm.includes('webmotors')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="Webmotors">
        <rect width="24" height="24" rx="6" fill="#E11A2B" />
        <path
          d="M5 8.5L8 15.5L12 9.5L16 15.5L19 8.5"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // OLX
  if (norm.includes('olx')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-label="OLX">
        <rect width="24" height="24" rx="6" fill="#6E0AD6" />
        <text
          x="12"
          y="15.5"
          textAnchor="middle"
          fill="#FFF"
          fontSize="8.5"
          fontWeight="900"
          fontFamily="system-ui, sans-serif"
        >
          OLX
        </text>
      </svg>
    );
  }

  // Sem Origem / Não informado
  if (norm.includes('sem_origem') || norm.includes('sem origem')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    );
  }

  // Default / Site / Desconhecido
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
