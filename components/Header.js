import LogoutButton from './LogoutButton';
import { createClient } from '../utils/supabase/server';

const Header = async () => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="bg-white shadow-md h-[65px] fixed top-0 w-full z-10 flex items-center justify-end px-6">
      <div>
        {user ? (
          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-700">{user.email}</span>
            <LogoutButton />
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default Header;