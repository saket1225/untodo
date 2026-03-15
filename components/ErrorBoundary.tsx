import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { Fonts, Spacing } from '../lib/theme';

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function ErrorFallback({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { colors } = useTheme();

  return (
    <View style={{
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
    }}>
      <Text style={{
        fontSize: 48,
        color: colors.textTertiary,
        marginBottom: Spacing.md,
      }}>!</Text>
      <Text style={{
        color: colors.text,
        fontFamily: Fonts.headingMedium,
        fontSize: 20,
        marginBottom: Spacing.sm,
      }}>Something went wrong</Text>
      <Text style={{
        color: colors.textSecondary,
        fontFamily: Fonts.body,
        fontSize: 14,
        textAlign: 'center',
        marginBottom: Spacing.xl,
      }}>{message}</Text>
      <TouchableOpacity
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: Spacing.xl,
          paddingVertical: 14,
        }}
        onPress={onRetry}
        accessibilityLabel="Try again"
        accessibilityRole="button"
      >
        <Text style={{
          color: colors.text,
          fontFamily: Fonts.bodyMedium,
          fontSize: 15,
        }}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('[ErrorBoundary] Caught error:', error.message, errorInfo.componentStack?.slice(0, 500));
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          message={this.props.fallbackMessage || 'An unexpected error occurred.'}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}
