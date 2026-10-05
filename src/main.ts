import '@fontsource-variable/figtree'; // bundled with the site, so no font request leaves the device
import './style.css';
import { start } from './app';

start(document.getElementById('app')!, document.getElementById('status')!);
