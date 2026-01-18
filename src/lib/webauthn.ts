import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/types';
import { storage } from '@/lib/unified-storage';
import { WebAuthnCredential } from '@/types/auth';
import { generateId } from '@/lib/utils';

// 获取 RP 信息
function getRPInfo() {
  const rpId = process.env.WEBAUTHN_RP_ID || 'localhost';
  const rpName = process.env.WEBAUTHN_RP_NAME || 'Serverless Bot';
  const origin = process.env.NEXTAUTH_URL || `https://${rpId}`;

  return { rpId, rpName, origin };
}

// ==================== 注册流程 ====================

export async function generateWebAuthnRegistrationOptions(userId: string) {
  const user = await storage.getUser(userId);
  if (!user) throw new Error('User not found');

  const { rpId, rpName } = getRPInfo();

  // 排除已注册的凭证
  const excludeCredentials = user.webauthnCredentials.map((cred) => ({
    id: cred.credentialId,
    type: 'public-key' as const,
    transports: cred.transports as AuthenticatorTransportFuture[],
  }));

  const options = await generateRegistrationOptions({
    rpName,
    rpID: rpId,
    userID: user.id,
    userName: user.email || user.name,
    userDisplayName: user.name,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
    timeout: 60000,
  });

  // 存储 challenge
  await storage.createChallenge({
    challenge: options.challenge,
    userId: user.id,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });

  return options;
}

export async function verifyWebAuthnRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  deviceName?: string
): Promise<WebAuthnCredential> {
  const user = await storage.getUser(userId);
  if (!user) throw new Error('User not found');

  const { rpId, origin } = getRPInfo();

  // 获取存储的 challenge
  const storedChallenge = await storage.getChallenge(response.response.clientDataJSON
    ? JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString()).challenge
    : '');
  
  if (!storedChallenge) throw new Error('Challenge not found or expired');

  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
    });
  } finally {
    await storage.deleteChallenge(storedChallenge.challenge);
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registration verification failed');
  }

  const { credential } = verification.registrationInfo;
  const now = new Date().toISOString();

  // v12: credential.id 已经是 base64url 字符串
  const webauthnCredential: WebAuthnCredential = {
    id: generateId(),
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: response.response.transports,
    createdAt: now,
    deviceName: deviceName || 'Unknown Device',
  };

  // 保存凭证
  const credentials = [...user.webauthnCredentials, webauthnCredential];
  await storage.updateUser(userId, { webauthnCredentials: credentials });

  return webauthnCredential;
}

// ==================== 登录流程 ====================

export async function generateWebAuthnAuthenticationOptions(email?: string) {
  const { rpId } = getRPInfo();

  let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] = [];

  if (email) {
    const user = await storage.getUserByEmail(email);
    if (user && user.webauthnCredentials.length > 0) {
      allowCredentials = user.webauthnCredentials.map((cred) => ({
        id: cred.credentialId,
        transports: cred.transports as AuthenticatorTransportFuture[],
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    userVerification: 'preferred',
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    timeout: 60000,
  });

  // 存储 challenge
  await storage.createChallenge({
    challenge: options.challenge,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });

  return options;
}

export async function verifyWebAuthnAuthentication(
  response: AuthenticationResponseJSON
): Promise<{ userId: string; credentialId: string }> {
  const { rpId, origin } = getRPInfo();

  // 根据 credential ID 查找用户
  const credentialId = response.id;
  const user = await storage.getUserByWebAuthnCredentialId(credentialId);
  
  if (!user) throw new Error('Credential not found');

  const credential = user.webauthnCredentials.find(
    (c) => c.credentialId === credentialId
  );
  if (!credential) throw new Error('Credential not found');

  // 获取存储的 challenge
  const clientData = JSON.parse(
    Buffer.from(response.response.clientDataJSON, 'base64url').toString()
  );
  const storedChallenge = await storage.getChallenge(clientData.challenge);
  
  if (!storedChallenge) throw new Error('Challenge not found or expired');

  let verification: VerifiedAuthenticationResponse;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: {
        id: credential.credentialId,
        publicKey: Buffer.from(credential.publicKey, 'base64url'),
        counter: credential.counter,
        transports: credential.transports as AuthenticatorTransportFuture[],
      },
    });
  } finally {
    await storage.deleteChallenge(storedChallenge.challenge);
  }

  if (!verification.verified) {
    throw new Error('Authentication verification failed');
  }

  // 更新 counter 和 lastUsedAt
  const updatedCredentials = user.webauthnCredentials.map((c) =>
    c.credentialId === credentialId
      ? {
          ...c,
          counter: verification.authenticationInfo.newCounter,
          lastUsedAt: new Date().toISOString(),
        }
      : c
  );

  await storage.updateUser(user.id, {
    webauthnCredentials: updatedCredentials,
    lastLoginAt: new Date().toISOString(),
  });

  return { userId: user.id, credentialId };
}
