# tests/utils.py
def register(client, email="u@test.com", username="u1", password="pass"):
    return client.post("/register", json={
        "email": email,
        "username": username,
        "password": password
    })

def login(client, email="u@test.com", password="pass"):
    return client.post("/login", json={"email": email, "password": password})