export interface Asset {
    uri: string;
    name: string;
    mimetype: string;
}

export interface Flashcard {
    front: string;
    back: string;
}

export interface EditedFlashcard {
    id: number;
    front: string;
    back: string;
    edited: boolean | undefined;
    created: boolean | undefined;
    deleted: boolean | undefined;
}

export interface Deck {
    id: number;
    name: string;
    cards: EditedFlashcard[] | Flashcard[];
}