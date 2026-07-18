// marketplace-backend/providers/quickbooks.js
export const qboConfigured = () => !!(process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET);
export const qboAuthorizeUrl = (state) => { /* logic to build URL */ };
export const qboExchangeCode = async (code) => { /* logic to exchange code */ };
export const qboEnsureToken = async (creds) => { /* logic to refresh */ };
export const qboCompanyName = async (creds) => { /* logic to fetch name */ };