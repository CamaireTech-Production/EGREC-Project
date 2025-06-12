import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { X } from 'lucide-react';
import { createUserDocument, updateUserLoginTimestamp } from '../../services/users';

interface AuthModalProps {
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { user } = await signInWithEmailAndPassword(auth, email, password);
        await updateUserLoginTimestamp(user.uid);
      } else {
        // Validate agency name
        if (agencyName.trim().length < 3) {
          throw new Error('Le nom de l\'agence doit contenir au moins 3 caractères');
        }

        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await createUserDocument(user.uid, {
          email,
          firstName,
          lastName,
          company,
          agencyName,
          createdAt: new Date().toISOString(),
        });
      }
      onClose();
    } catch (err) {
      let errorMessage = 'Une erreur est survenue';
      if (err instanceof Error) {
        switch (err.message) {
          case 'Firebase: Error (auth/invalid-email).':
            errorMessage = 'Email invalide';
            break;
          case 'Firebase: Error (auth/user-not-found).':
            errorMessage = 'Utilisateur non trouvé';
            break;
          case 'Firebase: Error (auth/wrong-password).':
            errorMessage = 'Mot de passe incorrect';
            break;
          case 'Firebase: Error (auth/email-already-in-use).':
            errorMessage = 'Cet email est déjà utilisé';
            break;
          case 'Firebase: Password should be at least 6 characters (auth/weak-password).':
            errorMessage = 'Le mot de passe doit contenir au moins 6 caractères';
            break;
          default:
            errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${auth.currentUser ? 'fixed inset-0 bg-black/70' : ''} flex items-center justify-center z-50`}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="bg-[#8B4513] text-white p-4 flex justify-between items-center rounded-t-lg">
          <h2 className="font-bold text-xl">
            {isLogin ? 'Connexion' : 'Inscription'}
          </h2>
          {auth.currentUser && (
            <button
              onClick={onClose}
              className="text-white hover:bg-[#663300] p-2 rounded-full"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {!isLogin && (
            <>
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">
                  Prénom
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                  required
                  placeholder="Entrez votre prénom"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">
                  Nom
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                  required
                  placeholder="Entrez votre nom"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">
                  Entreprise
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                  required
                  maxLength={100}
                  placeholder="Entrez le nom de votre entreprise"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">
                  Nom de votre agence
                </label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
                  required
                  minLength={3}
                  placeholder="Entrez le nom de votre agence"
                />
                {agencyName.length > 0 && agencyName.length < 3 && (
                  <p className="mt-1 text-sm text-red-600">
                    Le nom doit contenir au moins 3 caractères
                  </p>
                )}
              </div>
            </>
          )}

          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
              required
              placeholder="exemple@email.com"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-[#8B4513] focus:border-[#8B4513]"
              required
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#8B4513] text-white py-3 rounded-lg font-bold text-lg transition-colors hover:bg-[#663300] disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? 'Chargement...' : (isLogin ? 'Se connecter' : "S'inscrire")}
          </button>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#8B4513] hover:underline"
            >
              {isLogin ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;