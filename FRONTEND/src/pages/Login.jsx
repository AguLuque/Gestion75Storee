import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { Boton, Input } from '../components/ui/index.jsx';

export default function Login() {
    const [email, setEmail] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [mostrarContrasena, setMostrarContrasena] = useState(false);
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);
    const navegar = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setCargando(true);
        setError('');

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password: contrasena,
        });

        if (error) {
            setError('Email o contraseña incorrectos.');
            setCargando(false);
        } else {
            navegar('/');
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm animate-fade-in">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl shadow-lg mb-4 overflow-hidden bg-white border border-slate-200">
                        <img src="/Logo.png" alt="Logo" className="w-full h-full object-contain p-0" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">75 Storee</h1>
                    <p className="text-sm text-slate-500 mt-1">Sistema de gestión</p>
                </div>

                {/* Card */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                    <h2 className="text-base font-semibold text-slate-700 mb-5 text-center">Iniciar sesión</h2>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <Input
                            label="Gmail"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="tu@email.com"
                            required
                            autoComplete="email"
                        />

                        {/* Contraseña con toggle */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-slate-600">Contraseña</label>
                            <div className="relative">
                                <input
                                    type={mostrarContrasena ? 'text' : 'password'}
                                    value={contrasena}
                                    onChange={e => setContrasena(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setMostrarContrasena(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {mostrarContrasena ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
                                {error}
                            </div>
                        )}

                        <Boton type="submit" disabled={cargando} className="w-full justify-center mt-1 py-2.5">
                            <LogIn size={16} />
                            {cargando ? 'Ingresando...' : 'Ingresar'}
                        </Boton>
                    </form>
                </div>

                <p className="text-center text-xs text-slate-400 mt-6">
                    Sistema privado · Solo personal autorizado
                </p>
            </div>
        </div>
    );
}