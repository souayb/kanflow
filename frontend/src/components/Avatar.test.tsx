import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Avatar from './Avatar';

describe('Avatar component', () => {
  it('renders initials for two-word name', () => {
    render(<Avatar name="Alice Bob" />);
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('renders first two chars for single-word name', () => {
    render(<Avatar name="Charlie" />);
    expect(screen.getByText('CH')).toBeInTheDocument();
  });

  it('sets aria-label and title to the full name', () => {
    render(<Avatar name="Jane Doe" />);
    const el = screen.getByRole('generic', { name: 'Jane Doe' });
    expect(el).toHaveAttribute('title', 'Jane Doe');
  });

  it('applies a background color style', () => {
    const { container } = render(<Avatar name="Bob Smith" />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.backgroundColor).toBeTruthy();
    expect(div.style.backgroundColor).not.toBe('');
  });

  it('merges extra className', () => {
    const { container } = render(<Avatar name="X" className="w-10 h-10" />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('w-10');
    expect(div.className).toContain('h-10');
  });
});
