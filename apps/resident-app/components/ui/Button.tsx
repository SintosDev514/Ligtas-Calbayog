import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: object;
}

export const Button: React.FC<ButtonProps> = ({ 
  title, 
  onPress, 
  variant = 'primary', 
  disabled = false, 
  loading = false,
  style
}) => {
  return (
    <TouchableOpacity 
      style={[
        styles.button, 
        styles[variant], 
        disabled && styles.disabled,
        style
      ]} 
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'secondary' ? '#0F204B' : '#FFFFFF'} />
      ) : (
        <Text style={[
          styles.text, 
          variant === 'secondary' && styles.textSecondary,
          variant === 'outline' && styles.textOutline,
          disabled && styles.textDisabled
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 6, // Sharper, more official
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 2, // Slight shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  primary: {
    backgroundColor: '#0F204B', // PNP Navy Blue
  },
  secondary: {
    backgroundColor: '#F4B51A', // PNP Gold
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#0F204B',
    elevation: 0,
    shadowOpacity: 0,
  },
  disabled: {
    backgroundColor: '#E5E5EA',
    borderColor: '#E5E5EA',
    elevation: 0,
    shadowOpacity: 0,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  textSecondary: {
    color: '#0F204B', // Dark text on gold button
  },
  textOutline: {
    color: '#0F204B',
  },
  textDisabled: {
    color: '#999999',
  }
});
