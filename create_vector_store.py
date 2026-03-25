import json
import os


def main():
    # Chemin cible du vector store
    store_path = os.path.join(
        "chatbot-juridique", "backend", "rag", "vector_store.json"
    )
    store_dir = os.path.dirname(store_path)

    # Si le fichier existe deja, on ne fait rien
    if os.path.isfile(store_path):
        print("Vector store deja present, pas besoin de le regenerer")
        return

    # Cree les dossiers si besoin
    os.makedirs(store_dir, exist_ok=True)

    # Exemple de donnees pour un debutant
    payload = {
        "documents": [
            {"id": 1, "text": "Exemple de texte"},
            {"id": 2, "text": "Exemple de texte 2"},
        ],
        "embeddings": [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
        ],
    }

    # Ecrit le fichier JSON
    with open(store_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"Vector store cree: {store_path}")


if __name__ == "__main__":
    main()
