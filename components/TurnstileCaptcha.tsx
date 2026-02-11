import React, { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useColorScheme } from '@/hooks/use-color-scheme';

interface TurnstileCaptchaProps {
  siteKey: string;
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  appearance?: 'always' | 'execute' | 'interaction-only';
}

export default function TurnstileCaptcha({
  siteKey,
  onSuccess,
  onError,
  onExpire,
  appearance = 'always',
}: TurnstileCaptchaProps) {
  const webViewRef = useRef<WebView>(null);
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? 'dark' : 'light';
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if site key is configured
  const isCaptchaConfigured = siteKey && siteKey !== 'your_turnstile_site_key_here';

  // Auto-pass captcha in development/testing when not configured
  React.useEffect(() => {
    if (!isCaptchaConfigured) {
      console.warn('Turnstile site key not configured - captcha bypassed for development');
      onSuccess('dev-bypass-token');
    }
  }, [isCaptchaConfigured, onSuccess]);

  // If no site key is configured, show dev message
  if (!isCaptchaConfigured) {
    return (
      <View style={styles.container}>
        <Text style={styles.devText}>Captcha disabled (configure EXPO_PUBLIC_TURNSTILE_SITE_KEY)</Text>
      </View>
    );
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
        <style>
          body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: transparent;
          }
          #turnstile-container {
            display: flex;
            justify-content: center;
            align-items: center;
          }
        </style>
      </head>
      <body>
        <div id="turnstile-container"></div>
        <script>
          function initTurnstile() {
            if (typeof turnstile === 'undefined') {
              console.error('Turnstile not loaded');
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'error'
                }));
              }
              return;
            }

            try {
              turnstile.render('#turnstile-container', {
                sitekey: '${siteKey}',
                theme: '${theme}',
                appearance: '${appearance}',
                callback: function(token) {
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'success',
                      token: token
                    }));
                  }
                },
                'error-callback': function() {
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'error'
                    }));
                  }
                },
                'expired-callback': function() {
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'expired'
                    }));
                  }
                },
              });
            } catch (error) {
              console.error('Error rendering Turnstile:', error);
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'error'
                }));
              }
            }
          }

          // Wait for both DOM and Turnstile script to load
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
              setTimeout(initTurnstile, 100);
            });
          } else {
            setTimeout(initTurnstile, 100);
          }
        </script>
      </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'success':
          setIsLoading(false);
          onSuccess(data.token);
          break;
        case 'error':
          setHasError(true);
          setIsLoading(false);
          onError?.();
          break;
        case 'expired':
          setIsLoading(false);
          onExpire?.();
          break;
      }
    } catch (error) {
      console.error('Error parsing Turnstile message:', error);
      setHasError(true);
      setIsLoading(false);
      onError?.();
    }
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    console.error('WebView error loading Turnstile');
    setHasError(true);
    setIsLoading(false);
    onError?.();
  };

  if (hasError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Captcha failed to load. Please check your internet connection.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={[styles.webview, isLoading && styles.hidden]}
        onMessage={handleMessage}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        thirdPartyCookiesEnabled={true}
        androidLayerType="hardware"
        cacheEnabled={false}
        sharedCookiesEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webview: {
    width: 300,
    height: 80,
    backgroundColor: 'transparent',
  },
  hidden: {
    opacity: 0,
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  devText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 12,
    color: '#f44336',
    textAlign: 'center',
  },
});
