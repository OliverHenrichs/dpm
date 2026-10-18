import { useState } from "react";
import { useCameraPermissions } from "expo-camera";

/**
 * Scanning a code with `QrCodeScanner`: asks for the camera first, and hands the scanned text
 * on trimmed and upper-cased, the way codes are typed. Spread `scannerProps` onto the scanner,
 * rendered beside (not inside) the modal that starts it.
 */
export function useQrScanner(
  onScanned: (code: string) => void,
  onPermissionDenied: () => void,
) {
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const start = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        onPermissionDenied();
        return;
      }
    }
    setScanning(true);
  };

  const stop = () => setScanning(false);

  return {
    start,
    stop,
    scannerProps: {
      visible: scanning,
      onScanned: (data: string) => {
        setScanning(false);
        onScanned(data.trim().toUpperCase());
      },
      onClose: stop,
    },
  };
}
