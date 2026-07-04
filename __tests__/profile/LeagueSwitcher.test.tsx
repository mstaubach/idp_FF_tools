import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import LeagueSwitcher from '@/components/profile/LeagueSwitcher';
import { ProfileProvider } from '@/context/ProfileContext';
import { Profile } from '@/lib/profile/types';

const push = vi.fn();
let pathname = '/standings/111111';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));

const PROFILE: Profile = {
  sleeperUsername: 'mstaubach',
  sleeperUserId: '123',
  leagues: [
    { leagueId: '111111', name: 'League One' },
    { leagueId: '222222', name: 'League Two' },
  ],
  primaryLeagueId: '111111',
};

const onEditProfile = vi.fn();

function renderSwitcher() {
  return render(
    <ProfileProvider>
      <LeagueSwitcher onEditProfile={onEditProfile} />
    </ProfileProvider>
  );
}

async function openDropdown() {
  // Before opening, the active league name appears exactly once (button label)
  await waitFor(() => screen.getByText('League One'));
  fireEvent.click(screen.getByText('League One'));
}

beforeEach(() => {
  localStorage.clear();
  document.cookie = 'idp_active_league=; path=/; max-age=0';
  push.mockClear();
  onEditProfile.mockClear();
  pathname = '/standings/111111';
});

describe('LeagueSwitcher', () => {
  it('renders nothing when no profile exists', () => {
    const { container } = renderSwitcher();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the active league name as the button label', async () => {
    localStorage.setItem('idp_dynasty_profile', JSON.stringify(PROFILE));
    renderSwitcher();
    await waitFor(() =>
      expect(screen.getByText('League One')).toBeInTheDocument()
    );
  });

  it('selecting a league navigates the current tool to that league', async () => {
    localStorage.setItem('idp_dynasty_profile', JSON.stringify(PROFILE));
    renderSwitcher();
    await openDropdown();
    fireEvent.click(screen.getByText('League Two'));
    expect(push).toHaveBeenCalledWith('/standings/222222');
    expect(localStorage.getItem('idp_dynasty_active_league')).toBe('222222');
  });

  it('maps trade-tracker paths to the nested league route', async () => {
    pathname = '/trade-tracker/league/111111';
    localStorage.setItem('idp_dynasty_profile', JSON.stringify(PROFILE));
    renderSwitcher();
    await openDropdown();
    fireEvent.click(screen.getByText('League Two'));
    expect(push).toHaveBeenCalledWith('/trade-tracker/league/222222');
  });

  it('does not navigate from non-tool pages but still updates the league', async () => {
    pathname = '/';
    localStorage.setItem('idp_dynasty_profile', JSON.stringify(PROFILE));
    renderSwitcher();
    await openDropdown();
    fireEvent.click(screen.getByText('League Two'));
    expect(push).not.toHaveBeenCalled();
    expect(localStorage.getItem('idp_dynasty_active_league')).toBe('222222');
  });

  it('links "Different league…" to the tool landing page with picker=1', async () => {
    localStorage.setItem('idp_dynasty_profile', JSON.stringify(PROFILE));
    renderSwitcher();
    await openDropdown();
    const link = screen.getByText('Different league…');
    expect(link).toHaveAttribute('href', '/standings?picker=1');
  });

  it('hides "Different league…" off tool pages', async () => {
    pathname = '/';
    localStorage.setItem('idp_dynasty_profile', JSON.stringify(PROFILE));
    renderSwitcher();
    await openDropdown();
    expect(screen.queryByText('Different league…')).toBeNull();
  });

  it('shows the username header when the menu is open', async () => {
    localStorage.setItem('idp_dynasty_profile', JSON.stringify(PROFILE));
    renderSwitcher();
    await openDropdown();
    expect(screen.getByText('@mstaubach')).toBeInTheDocument();
  });

  it('clicking "Edit profile" calls onEditProfile and does not navigate', async () => {
    localStorage.setItem('idp_dynasty_profile', JSON.stringify(PROFILE));
    renderSwitcher();
    await openDropdown();
    fireEvent.click(screen.getByText('Edit profile'));
    expect(onEditProfile).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('clicking "Clear profile" removes the profile', async () => {
    localStorage.setItem('idp_dynasty_profile', JSON.stringify(PROFILE));
    const { container } = renderSwitcher();
    await openDropdown();
    fireEvent.click(screen.getByText('Clear profile'));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(localStorage.getItem('idp_dynasty_profile')).toBeNull();
  });
});
