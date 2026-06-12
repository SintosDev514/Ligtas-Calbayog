import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';

interface TypographyProps extends TextProps {
  variant?: 'h1' | 'h2' | 'h3' | 'subtitle' | 'body' | 'caption';
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  color?: string;
}

export const Typography: React.FC<TypographyProps> = ({
  variant = 'body',
  align = 'left',
  color = '#333333',
  style,
  children,
  ...props
}) => {
  return (
    <Text
      style={[
        styles[variant],
        { textAlign: align, color },
        style
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  h1: {
    fontSize: 32,
    fontWeight: '800', // Bolder for authoritative look
    marginBottom: 16,
    color: '#0F204B', // PNP Navy Blue
    letterSpacing: 0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    color: '#0F204B',
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
    color: '#0F204B',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#11181C',
  },
  caption: {
    fontSize: 12,
    color: '#666666', // slightly darker for better readability
  },
});
