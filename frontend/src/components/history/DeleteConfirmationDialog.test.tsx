import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';

describe('DeleteConfirmationDialog', () => {
  it('renders the confirmation message with the record ID', () => {
    render(
      <DeleteConfirmationDialog
        recordId={42}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Delete Record')).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
  });

  it('renders cancel and delete buttons', () => {
    render(
      <DeleteConfirmationDialog
        recordId={42}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete$/i })).toBeInTheDocument();
  });

  it('calls onConfirm when delete button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmationDialog
        recordId={42}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /delete$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <DeleteConfirmationDialog
        recordId={42}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when clicking the backdrop', () => {
    const onCancel = vi.fn();
    render(
      <DeleteConfirmationDialog
        recordId={42}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    const backdrop = screen.getByRole('dialog').querySelector('.absolute');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows deleting state when isPending is true', () => {
    render(
      <DeleteConfirmationDialog
        recordId={42}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isPending={true}
      />
    );

    expect(screen.getByText('Deleting...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('has proper accessibility attributes', () => {
    render(
      <DeleteConfirmationDialog
        recordId={42}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Confirm delete');
  });
});
