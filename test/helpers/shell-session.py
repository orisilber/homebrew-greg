import errno, json, os, pty, select, shlex, sys
request = json.loads(sys.argv[1])
pid, master = pty.fork()
if pid == 0:
    os.chdir(request['cwd'])
    environment = dict(request['env'])
    for name in ['GREG_SESSION_ID', 'TERM_SESSION_ID', 'ITERM_SESSION_ID']:
        environment.pop(name, None)
    script = '\n'.join(shlex.join(command) for command in request['commands']) + '\nexit $?\n'
    os.execve('/bin/zsh', ['zsh', '-f', '-c', script], environment)
try:
    while True:
        ready, _, _ = select.select([master], [], [], 0.1)
        if ready:
            try:
                data = os.read(master, 65536)
            except OSError as error:
                if error.errno == errno.EIO: break
                raise
            if not data: break
            os.write(1, data)
finally:
    os.close(master)
_, status = os.waitpid(pid, 0)
sys.exit(os.waitstatus_to_exitcode(status))
