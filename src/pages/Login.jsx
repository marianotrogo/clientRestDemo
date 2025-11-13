import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../store/authSlice';
import { Link } from 'react-router-dom';

export default function Login() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user, loading, error, token } = useSelector(s => s.auth);

    const [email, setEmail] = useState('admin@demo.com');
    const [password, setPassword] = useState('admin123');

    useEffect(() => {
        if (token && user) {          // usamos token + user para evitar bucles
            navigate('/', { replace: true });
        }
    }, [user, token, navigate]);

    const onSubmit = async (e) => {
        e.preventDefault();
        await dispatch(login({ email, password }));
    };

    return (
        <div className='min-h-screen flex items-center justify-center bg-gray-50'>
            <form onSubmit={onSubmit} className='bg-white p-6 rounded-2xl shadow w-full max-w-sm space-y-3'>
                <h1 className='text-xl font-semibold'>Ingresar</h1>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <input
                    className='border rounded p-2 w-full'
                    placeholder='Email'
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                />
                <input
                    className='border rounded p-2 w-full'
                    placeholder='Password'
                    type='password'
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                />
                <button
                    className='w-full bg-black text-white rounded p-2 disabled:opacity-50'
                    disabled={loading}>
                    {loading ? 'Entrando...' : 'Entrar'}
                </button>

                <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline block text-center">
                    ¿Olvidaste tu contraseña?
                </Link>
            </form>
        </div>
    );
}
