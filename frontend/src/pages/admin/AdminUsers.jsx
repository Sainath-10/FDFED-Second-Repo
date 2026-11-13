/**
 * NEXUS ESPORTS — Admin users
 *
 * Every account from the backend with warn, ban, unban and password reset.
 */
import UserDirectory from '../../components/UserDirectory.jsx';

export default function AdminUsers() {
  return <UserDirectory title="Users" subtitle="Every registered account. Admins can moderate players; only a Super Admin can moderate staff." />;
}
