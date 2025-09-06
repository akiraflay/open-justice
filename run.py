#!/usr/bin/env python3
"""
OpenJustice Development Server Runner
Starts both frontend and backend services simultaneously
"""

import os
import sys
import subprocess
import signal
import time
from pathlib import Path

# ANSI color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_colored(message, color):
    """Print colored message to terminal"""
    print(f"{color}{message}{Colors.ENDC}")

def print_banner():
    """Print application banner"""
    banner = """
    ╔═══════════════════════════════════════════════╗
    ║           OpenJustice Development             ║
    ║         Legal Document Analysis System        ║
    ╔═══════════════════════════════════════════════╗
    """
    print_colored(banner, Colors.CYAN + Colors.BOLD)

def check_requirements():
    """Check if required tools are installed"""
    requirements = {
        'node': 'Node.js is required for the frontend',
        'python3': 'Python 3 is required for the backend',
        'pip3': 'pip3 is required for Python packages'
    }
    
    missing = []
    for cmd, description in requirements.items():
        try:
            subprocess.run([cmd, '--version'], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            missing.append(f"  - {description} ({cmd})")
    
    if missing:
        print_colored("❌ Missing requirements:", Colors.RED)
        for item in missing:
            print(item)
        print_colored("\nPlease install the missing requirements and try again.", Colors.YELLOW)
        sys.exit(1)

def setup_backend_env():
    """Create .env file from .env.example if it doesn't exist"""
    backend_dir = Path(__file__).parent / 'backend'
    env_file = backend_dir / '.env'
    env_example = backend_dir / '.env.example'
    
    if not env_file.exists() and env_example.exists():
        print_colored("📝 Creating backend .env file from .env.example...", Colors.YELLOW)
        env_file.write_text(env_example.read_text())
        print_colored("✅ Backend .env file created", Colors.GREEN)

def install_dependencies():
    """Check and install dependencies if needed"""
    # Check frontend dependencies
    frontend_dir = Path(__file__).parent / 'frontend'
    if not (frontend_dir / 'node_modules').exists():
        print_colored("📦 Installing frontend dependencies...", Colors.YELLOW)
        subprocess.run(['npm', 'install'], cwd=frontend_dir, check=True)
        print_colored("✅ Frontend dependencies installed", Colors.GREEN)
    
    # Check backend dependencies
    backend_dir = Path(__file__).parent / 'backend'
    venv_python = Path(__file__).parent / 'venv' / 'bin' / 'python'
    
    # Use venv python if it exists
    if venv_python.exists():
        python_executable = str(venv_python)
    else:
        python_executable = sys.executable
    
    # Check if dependencies are installed
    check_deps = subprocess.run(
        [python_executable, '-c', 'import flask, flask_cors, PyPDF2, openai'],
        capture_output=True
    )
    
    if check_deps.returncode != 0:
        print_colored("📦 Installing backend dependencies...", Colors.YELLOW)
        subprocess.run([python_executable, '-m', 'pip', 'install', '-r', 'requirements.txt'], 
                      cwd=backend_dir, check=True)
        print_colored("✅ Backend dependencies installed", Colors.GREEN)

def start_services():
    """Start frontend and backend services"""
    processes = []
    
    try:
        # Setup environment
        setup_backend_env()
        
        # Install dependencies if needed
        install_dependencies()
        
        print_colored("\n🚀 Starting services...\n", Colors.GREEN + Colors.BOLD)
        
        # Start backend
        backend_dir = Path(__file__).parent / 'backend'
        venv_python = Path(__file__).parent / 'venv' / 'bin' / 'python'
        
        # Use venv python if it exists, otherwise fall back to system python
        if venv_python.exists():
            python_executable = str(venv_python)
            print_colored("Using virtual environment", Colors.GREEN)
        else:
            python_executable = sys.executable
            
        print_colored("Starting Flask backend on http://localhost:5001", Colors.BLUE)
        backend_process = subprocess.Popen(
            [python_executable, 'app.py'],
            cwd=backend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        processes.append(('Backend', backend_process, Colors.BLUE))
        
        # Give backend time to start
        time.sleep(2)
        
        # Start frontend
        frontend_dir = Path(__file__).parent / 'frontend'
        print_colored("Starting Next.js frontend on http://localhost:3000", Colors.CYAN)
        frontend_process = subprocess.Popen(
            ['npm', 'run', 'dev'],
            cwd=frontend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1,
            env={**os.environ, 'NEXT_PUBLIC_API_URL': 'http://localhost:5001'}
        )
        processes.append(('Frontend', frontend_process, Colors.CYAN))
        
        print_colored("\n✨ Services are starting up...", Colors.GREEN)
        print_colored("━" * 50, Colors.GREEN)
        print_colored("Frontend: http://localhost:3000", Colors.CYAN)
        print_colored("Backend:  http://localhost:5001", Colors.BLUE)
        print_colored("━" * 50, Colors.GREEN)
        print_colored("\nPress Ctrl+C to stop all services\n", Colors.YELLOW)
        
        # Monitor processes and display output
        import threading
        
        def monitor_output(name, process, color):
            """Monitor and display process output"""
            for line in iter(process.stdout.readline, ''):
                if line:
                    print(f"{color}[{name}]{Colors.ENDC} {line.rstrip()}")
        
        # Start monitoring threads
        threads = []
        for name, process, color in processes:
            thread = threading.Thread(target=monitor_output, args=(name, process, color))
            thread.daemon = True
            thread.start()
            threads.append(thread)
        
        # Wait for processes
        while True:
            for name, process, _ in processes:
                if process.poll() is not None:
                    print_colored(f"\n❌ {name} stopped unexpectedly!", Colors.RED)
                    raise KeyboardInterrupt
            time.sleep(1)
            
    except KeyboardInterrupt:
        print_colored("\n\n🛑 Shutting down services...", Colors.YELLOW)
        for name, process, _ in processes:
            if process.poll() is None:
                print_colored(f"  Stopping {name}...", Colors.YELLOW)
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
        print_colored("✅ All services stopped", Colors.GREEN)
        sys.exit(0)
    except Exception as e:
        print_colored(f"\n❌ Error: {e}", Colors.RED)
        for name, process, _ in processes:
            if process.poll() is None:
                process.terminate()
        sys.exit(1)

def main():
    """Main entry point"""
    print_banner()
    
    # Check requirements
    print_colored("🔍 Checking requirements...", Colors.YELLOW)
    check_requirements()
    print_colored("✅ All requirements met", Colors.GREEN)
    
    # Start services
    start_services()

if __name__ == '__main__':
    main()