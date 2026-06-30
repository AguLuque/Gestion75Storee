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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50 to-slate-50 flex items-center justify-center p-4 relative overflow-hidden">

            {/* Formas de fondo decorativas */}
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-200/40 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary-300/30 rounded-full blur-3xl" />

            <div className="w-full max-w-sm animate-fade-in relative z-10">

                {/* Header */}
                <div className="text-center mb-6">
                    <img
                        src="/Logo.png"
                        alt="Logo"
                        className="w-70 h-70 mx-auto object-contain animate-float"
                    />
                    <p className="text-sm text-slate-500 -mt-8">Ordená hoy tu negocio para crecer mañana.</p>
                </div>

                {/* Card */}
                <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-xl shadow-primary-900/5 p-6">
                    <h2 className="text-base font-semibold text-slate-700 mb-1 text-center">Iniciar sesión</h2>
                    <p className="text-xs text-slate-400 text-center mb-5">Ingresá tus credenciales para continuar</p>
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
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white transition-all"
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

                    <div className="flex items-center gap-3 my-5">
                        <div className="h-px flex-1 bg-slate-200" />
                        <span className="text-xs text-slate-400">FluxoGest</span>
                        <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    <p className="text-center text-xs text-slate-400">
                        ¿Problemas para ingresar?{" "}
                        <a
                            href="https://mail.google.com/mail/u/0/?fs=1&to=agustinluque.lbz@gmail.com&su=Soporte%20FluxoGest&body=Hola,%20necesito%20ayuda%20con%20FluxoGest.%0A%0ADescribo%20mi%20problema:%20&tf=cm" target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-400 underline"
                        >
                            Contactate con soporte.
                        </a>
                    </p>
                </div>

                <p className="text-center text-xs text-slate-400 mt-6">
                    Sistema privado · Solo personal autorizado
                </p>
            </div>
        </div>
    );
}