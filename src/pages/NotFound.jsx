import { Link } from 'react-router-dom'
import { Pokeball } from '../components/Pokeball'

export default function NotFound() {
  return (
    <div className="mt-20 flex flex-col items-center text-center">
      <Pokeball className="h-20 w-20 animate-bounce" />
      <h1 className="poke-title mt-4 text-5xl">404</h1>
      <p className="font-comic mt-2 text-2xl tracking-wider">A wild empty page appeared!</p>
      <Link to="/" className="btn btn-primary mt-6">
        Back to market
      </Link>
    </div>
  )
}
