/**
 * NEXUS ESPORTS — Super Admin users
 *
 * Every account from the backend with warn, unban and password reset.
 */
import UserDirectory from '../../components/UserDirectory.jsx';

export default function SuperUsers() {
  return <UserDirectory title="Users" subtitle="Every registered account, including staff." />;
}
