type Language = 'en' | 'es';

export const strings: Record<Language, Record<string, any>> = {
  en: {
    auth: {
      login: 'Log In',
      signup: 'Sign Up',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      google: 'Continue with Google',
      apple: 'Continue with Apple',
      loginButton: 'Log In',
      signupButton: 'Create Account',
      noAccount: "Don't have an account?",
      haveAccount: 'Already have an account?',
      forgotPassword: 'Forgot password?',
      error: 'Error',
      subtitle: 'Detect deals before everyone else',
      or: 'or',
      referralCode: 'Referral code (optional)',
      toggleLogin: "Don't have an account? ",
      toggleSignup: 'Already have an account? ',
    },
    common: {
      ok: 'OK',
      cancel: 'Cancel',
    },
  },
  es: {
    auth: {
      login: 'Iniciar Sesión',
      signup: 'Crear Cuenta',
      email: 'Correo',
      password: 'Contraseña',
      confirmPassword: 'Confirmar Contraseña',
      google: 'Continuar con Google',
      apple: 'Continuar con Apple',
      loginButton: 'Iniciar Sesión',
      signupButton: 'Crear Cuenta',
      noAccount: '¿No tienes cuenta?',
      haveAccount: '¿Ya tienes cuenta?',
      forgotPassword: '¿Olvidaste tu contraseña?',
      error: 'Error',
      subtitle: 'Detecta ofertas antes que todos',
      or: 'o',
      referralCode: 'Código de referencia (opcional)',
      toggleLogin: '¿No tienes cuenta? ',
      toggleSignup: '¿Ya tienes cuenta? ',
    },
    common: {
      ok: 'OK',
      cancel: 'Cancelar',
    },
  },
};

export function getStrings(language: Language) {
  return strings[language] || strings.en;
}
