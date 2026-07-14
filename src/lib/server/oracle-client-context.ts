const CLIENT_ID_HEADER = "x-oracle-client-id";
const CLIENT_ID_PATTERN = /^[a-z0-9-]{8,80}$/i;

export function getOracleClientId(request: Request) {
  const clientId = request.headers.get(CLIENT_ID_HEADER)?.trim();
  return clientId && CLIENT_ID_PATTERN.test(clientId) ? clientId : null;
}

export function getClientCollectionName(request: Request, collectionName: string) {
  const clientId = getOracleClientId(request);
  if (!clientId) return null;

  const extensionIndex = collectionName.lastIndexOf(".");
  if (extensionIndex === -1) return `${collectionName}.${clientId}`;

  return `${collectionName.slice(0, extensionIndex)}.${clientId}${collectionName.slice(extensionIndex)}`;
}
