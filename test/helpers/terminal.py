"""Run the real CLI in a terminal, forwarding output and optional confirmation."""
import errno
import json
import os
import pty
import select
import subprocess
import sys

request = json.loads(sys.argv[1])
master, slave = pty.openpty()
child = subprocess.Popen(request['command'], cwd=request['cwd'], env=request['env'],
                         stdin=slave, stdout=slave, stderr=slave)
os.close(slave)
output = b''
answered = False
try:
    while True:
        ready, _, _ = select.select([master], [], [], 0.1)
        if ready:
            try:
                data = os.read(master, 65536)
            except OSError as error:
                if error.errno == errno.EIO:
                    break
                raise
            if not data:
                break
            output += data
            os.write(1, data)
            if b'[y/N]' in output and not answered and 'answer' in request:
                os.write(master, (request['answer'] + '\n').encode())
                answered = True
        elif child.poll() is not None:
            break
finally:
    os.close(master)
    if child.poll() is None:
        child.terminate()
    status = child.wait(timeout=3)
sys.exit(status if status >= 0 else 128 - status)
