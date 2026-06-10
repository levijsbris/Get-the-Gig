import { Navigate, Route, Routes } from 'react-router-dom';
import { Account } from './routes/Account';
import { Login } from './routes/Login';
import { RequireAuth } from './routes/RequireAuth';
import { Signup } from './routes/Signup';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/signup/username" element={<Signup />} />
      <Route element={<RequireAuth />}>
        <Route path="/account" element={<Account />} />
      </Route>
      <Route path="*" element={<Navigate to="/account" replace />} />
    </Routes>
  );
}
