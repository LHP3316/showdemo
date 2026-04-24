import { AuthProvider } from './store/AuthContext';
import AppRouter from './router';

const App = () => {
    return (
        <AuthProvider>
            <AppRouter />
        </AuthProvider>
    );
}

export default App;
