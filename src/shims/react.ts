// The artifact loads React from a pinned CDN UMD build; this shim maps imports to that global.
// In the Next.js app, delete this file and import React normally.
const R = (globalThis as any).React;
export default R;
export const { useState, useEffect, useMemo, useRef, useCallback, useContext, createContext, forwardRef, Fragment } = R;
