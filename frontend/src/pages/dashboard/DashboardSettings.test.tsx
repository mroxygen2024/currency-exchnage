import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DashboardSettings } from './DashboardSettings';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockLogout = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: 1,
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      role: 'user',
      is_active: true,
      is_deleted: false,
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: mockLogout,
    refreshSession: vi.fn(),
    clearError: vi.fn(),
  })),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUpdateProfile = vi.fn();
const mockChangePassword = vi.fn();
const mockDeleteAccount = vi.fn();

vi.mock('../../api/endpoints/users', () => ({
  usersApi: {
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
    changePassword: (...args: unknown[]) => mockChangePassword(...args),
    deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
  },
}));

describe('DashboardSettings', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <DashboardSettings />
        </BrowserRouter>
      </QueryClientProvider>
    );

  it('renders the page title and description', () => {
    renderComponent();

    expect(screen.getByText('Account Settings')).toBeInTheDocument();
    expect(screen.getByText(/Manage your profile/)).toBeInTheDocument();
  });

  it('renders user avatar with initial', () => {
    renderComponent();

    const avatar = screen.getByTestId('user-avatar');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveTextContent('T');
  });

  it('renders user name and email on avatar card', () => {
    renderComponent();

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders user role badge on avatar card', () => {
    renderComponent();

    const badges = screen.getAllByText(/user/i);
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the profile form with fields', () => {
    renderComponent();

    expect(screen.getByTestId('profile-form')).toBeInTheDocument();
    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByTestId('profile-submit')).toBeInTheDocument();
    expect(screen.getByTestId('profile-submit')).toHaveTextContent('Save Profile Info');
  });

  it('renders email as read-only in profile section', () => {
    renderComponent();

    const emailInput = screen.getByDisplayValue('test@example.com');
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('readOnly');
  });

  it('renders role badge in profile section', () => {
    renderComponent();

    expect(screen.getByText(/Role: user/)).toBeInTheDocument();
  });

  it('renders the password form with fields', () => {
    renderComponent();

    expect(screen.getByTestId('password-form')).toBeInTheDocument();
    expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
    expect(screen.getByTestId('password-submit')).toBeInTheDocument();
    expect(screen.getByTestId('password-submit')).toHaveTextContent('Update Credentials');
  });

  it('renders the delete account section with button', () => {
    renderComponent();

    expect(screen.getByTestId('delete-section')).toBeInTheDocument();
    expect(screen.getByTestId('delete-account-btn')).toBeInTheDocument();
    expect(screen.getByTestId('delete-account-btn')).toHaveTextContent('Delete My Account');
  });

  it('shows profile validation errors when fields are empty', async () => {
    renderComponent();

    const firstNameInput = screen.getByLabelText('First Name');
    fireEvent.change(firstNameInput, { target: { value: '' } });

    const submitBtn = screen.getByTestId('profile-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const errors = screen.getAllByTestId('profile-error');
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0]).toHaveTextContent(/required/i);
    });
  });

  it('shows password validation errors when fields are empty', async () => {
    renderComponent();

    const submitBtn = screen.getByTestId('password-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const errors = screen.getAllByTestId('password-error');
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows password mismatch error', async () => {
    renderComponent();

    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'currentpass123' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'differentpass123' } });

    fireEvent.click(screen.getByTestId('password-submit'));

    await waitFor(() => {
      const errors = screen.getAllByTestId('password-error');
      expect(errors.some((e) => e.textContent?.includes('match'))).toBe(true);
    });
  });

  it('shows same password error', async () => {
    renderComponent();

    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'samepassword123' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'samepassword123' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'samepassword123' } });

    fireEvent.click(screen.getByTestId('password-submit'));

    await waitFor(() => {
      const errors = screen.getAllByTestId('password-error');
      expect(errors.some((e) => e.textContent?.includes('different'))).toBe(true);
    });
  });

  it('submits profile form successfully', async () => {
    mockUpdateProfile.mockResolvedValueOnce({
      id: 1,
      email: 'test@example.com',
      first_name: 'Updated',
      last_name: 'User',
      role: 'user',
      is_active: true,
      is_deleted: false,
    });

    renderComponent();

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Updated' } });
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'User' } });

    fireEvent.click(screen.getByTestId('profile-submit'));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        first_name: 'Updated',
        last_name: 'User',
      });
    });

    await waitFor(() => {
      const notification = screen.getByTestId('settings-notification');
      expect(notification).toHaveTextContent('Profile information updated successfully!');
    });
  });

  it('shows error notification on profile update failure', async () => {
    mockUpdateProfile.mockRejectedValueOnce(new Error('Failed to update profile.'));

    renderComponent();

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Updated' } });
    fireEvent.click(screen.getByTestId('profile-submit'));

    await waitFor(() => {
      const notification = screen.getByTestId('settings-notification');
      expect(notification).toHaveTextContent('Failed to update profile.');
    });
  });

  it('submits password form successfully', async () => {
    mockChangePassword.mockResolvedValueOnce({ success: true, message: 'Password updated' });

    renderComponent();

    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'oldpassword123' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpassword456' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'newpassword456' } });

    fireEvent.click(screen.getByTestId('password-submit'));

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith({
        current_password: 'oldpassword123',
        new_password: 'newpassword456',
      });
    });

    await waitFor(() => {
      const notification = screen.getByTestId('settings-notification');
      expect(notification).toHaveTextContent('Password updated successfully!');
    });
  });

  it('shows error notification on password change failure', async () => {
    mockChangePassword.mockRejectedValueOnce(new Error('Incorrect current password.'));

    renderComponent();

    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'wrongpassword' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpassword456' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'newpassword456' } });

    fireEvent.click(screen.getByTestId('password-submit'));

    await waitFor(() => {
      const notification = screen.getByTestId('settings-notification');
      expect(notification).toHaveTextContent('Incorrect current password.');
    });
  });

  it('shows delete confirmation dialog when delete button is clicked', () => {
    renderComponent();

    fireEvent.click(screen.getByTestId('delete-account-btn'));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Delete Account');
    expect(dialog.querySelector('button:last-child')).toHaveTextContent('Delete My Account');
  });

  it('closes delete dialog on cancel', () => {
    renderComponent();

    fireEvent.click(screen.getByTestId('delete-account-btn'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls deleteAccount and navigates on confirm', async () => {
    mockDeleteAccount.mockResolvedValueOnce({ success: true, message: 'Account deleted' });

    renderComponent();

    fireEvent.click(screen.getByTestId('delete-account-btn'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const confirmBtn = screen.getAllByText('Delete My Account')[1];
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('shows error notification on delete failure', async () => {
    mockDeleteAccount.mockRejectedValueOnce(new Error('Failed to delete account.'));

    renderComponent();

    fireEvent.click(screen.getByTestId('delete-account-btn'));
    const confirmBtn = screen.getAllByText('Delete My Account')[1];
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      const notification = screen.getByTestId('settings-notification');
      expect(notification).toHaveTextContent('Failed to delete account.');
    });
  });

  it('shows pending state on profile submit button', async () => {
    mockUpdateProfile.mockImplementationOnce(() => new Promise(() => {}));

    renderComponent();

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByTestId('profile-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('profile-submit')).toHaveTextContent('Saving...');
    });
  });

  it('shows pending state on password submit button', async () => {
    mockChangePassword.mockImplementationOnce(() => new Promise(() => {}));

    renderComponent();

    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'currentpass123' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpassword456' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'newpassword456' } });

    fireEvent.click(screen.getByTestId('password-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('password-submit')).toHaveTextContent('Updating...');
    });
  });
});
