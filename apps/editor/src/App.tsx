import { Navigate, Route, Routes } from 'react-router-dom';
import { Account } from './routes/Account';
import { AssetLibrary } from './routes/AssetLibrary';
import { Home } from './routes/Home';
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
        <Route path="/" element={<Home />} />
        <Route path="/account" element={<Account />} />
        <Route path="/portfolios/:id/assets" element={<AssetLibrary />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
