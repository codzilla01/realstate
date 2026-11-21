import { createRemoteJWKSet, jwtVerify } from 'jose';

export const googleIssuer = ['https://accounts.google.com', 'accounts.google.com'];
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), {timeoutDuration:5000});

export async function verifyGoogleIdToken(token, {clientId,nonce,keys = googleKeys}) {
  const {payload} = await jwtVerify(token,keys,{
    algorithms:['RS256'], issuer:googleIssuer, audience:clientId, maxTokenAge:'10m', clockTolerance:5,
    requiredClaims:['exp','iat','sub','nonce','email','email_verified'],
  });
  if (payload.nonce !== nonce || (payload.azp !== undefined && payload.azp !== clientId)) throw new Error('Google token binding failed');
  return payload;
}

export function allowedGoogleAccount(claims, email) {
  if (claims?.email_verified !== true || typeof claims.email !== 'string' || claims.email.toLowerCase() !== email || typeof claims.sub !== 'string' || !claims.sub) return false;
  // Google is authoritative for Gmail and Workspace accounts, not arbitrary third-party addresses.
  const domain = email.slice(email.lastIndexOf('@')+1);
  return domain === 'gmail.com' || domain === 'googlemail.com' || (typeof claims.hd === 'string' && claims.hd.toLowerCase() === domain);
}

export async function exchangeGoogleCode({code,verifier,nonce,config,fetcher = fetch}) {
  const response = await fetcher('https://oauth2.googleapis.com/token',{
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, redirect:'error', signal:AbortSignal.timeout(5000),
    body:new URLSearchParams({code,client_id:config.clientId,client_secret:config.clientSecret,
      redirect_uri:config.redirectUri,grant_type:'authorization_code',code_verifier:verifier}),
  });
  if (!response.ok) throw new Error('Google code exchange rejected');
  const {id_token:token} = await response.json();
  if (typeof token !== 'string' || token.length > 16_384) throw new Error('Google did not return an ID token');
  return verifyGoogleIdToken(token,{clientId:config.clientId,nonce});
}
