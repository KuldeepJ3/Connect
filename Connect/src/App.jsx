import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import { UserProvider } from './Context/UserContext';
import Home from './pages/Home';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';

function App() {

  const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('Token');
    if (!token) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />
          <Route path="/user/:id" element={<UserProfile />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}

export default App;