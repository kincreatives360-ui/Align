import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useToast } from '../../state/toastStore';
import { Toast } from './Toast';

afterEach(() => {
  act(() => {
    useToast.setState({ toasts: [] });
  });
});

describe('Toast', () => {
  it('renders default toasts without crashing', () => {
    act(() => {
      useToast.setState({
        toasts: [{ id: 1, message: 'The image exporter is not built yet.', type: 'default' }],
      });
    });

    render(<Toast />);
    expect(screen.getByRole('status').textContent).toContain('The image exporter is not built yet.');
  });
});
