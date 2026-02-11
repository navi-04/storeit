const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeDomain = (domain) => domain.trim().toLowerCase().replace(/^@+/, '');

export const getAuthEmailDomains = () => {
  const configured = process.env.REACT_APP_AUTH_EMAIL_DOMAIN;
  const domains = [configured, 'storeit.com', 'storeit.app']
    .filter(Boolean)
    .map(normalizeDomain)
    .filter(Boolean);

  return [...new Set(domains)];
};

export const isEmail = (value = '') => EMAIL_REGEX.test(value.trim());

export const usernameToEmail = (username, domain = getAuthEmailDomains()[0]) => {
  const cleanUsername = (username || '').toLowerCase().trim();
  const cleanDomain = normalizeDomain(domain || 'storeit.com');
  return `${cleanUsername}@${cleanDomain}`;
};

export const getLoginEmailCandidates = (usernameOrEmail) => {
  const value = (usernameOrEmail || '').trim();
  if (!value) return [];
  if (isEmail(value)) return [value.toLowerCase()];

  return getAuthEmailDomains().map((domain) => usernameToEmail(value, domain));
};
