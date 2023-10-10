import { db } from '../db.js';
import jwt from 'jsonwebtoken';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
import { bufferToDataURI } from '../utlis.js';


export const getPosts = async (req, res) => {
    const { page } = req.query;
    let q = "SELECT posts.*, users.name, users.username, users.userImg, " +
        "(SELECT COUNT(likes.postId) FROM likes GROUP BY likes.postId HAVING likes.postId = posts.id) AS likes " +
        "FROM posts LEFT JOIN users ON posts.username = users.username ORDER BY createdAt DESC";

    if (page) {
        const amountOfPosts = 4;
        q += ` LIMIT ${(page - 1) * 4},${amountOfPosts}`;
    }

    try {
        const posts = await queryDatabase(q);
        const postIds = posts.map((post) => post.id);

        const mediaPromises = postIds.map((postId) => {
            const mediaQuery = `SELECT * FROM posts_media WHERE post_id = "${postId}"`;
            return queryDatabase(mediaQuery);
        });

        const mediaData = await Promise.all(mediaPromises);

        const postsWithMedia = posts.map((post, index) => ({
            ...post,
            media: mediaData[index],
        }));

        return res.status(200).json(postsWithMedia);
    } catch (err) {
        console.error('Error fetching posts:', err);
        return res.status(500).json({ error: 'An error occurred while fetching posts.' });
    }
};

export const getFollowingPosts = async (req, res) => {
    const { page } = req.query;
    let q = "SELECT posts.*, users.name, users.userImg FROM posts JOIN followers ON followers.followedUsername = posts.username JOIN users ON users.username = posts.username WHERE followers.followerUsername=?;";

    if (page) {
        const amountOfPosts = 3;
        q += ` LIMIT ${(page - 1) * 3},${amountOfPosts}`;
    }

    try {
        const posts = await queryDatabase(q, [req.body.sendData]);
        const postIds = posts.map((post) => post.id);

        const mediaPromises = postIds.map((postId) => {
            const mediaQuery = `SELECT * FROM posts_media WHERE post_id = "${postId}"`;
            return queryDatabase(mediaQuery);
        });

        const mediaData = await Promise.all(mediaPromises);

        const postsWithMedia = posts.map((post, index) => ({
            ...post,
            media: mediaData[index],
        }));

        return res.status(200).json(postsWithMedia);
    } catch (err) {
        console.error('Error fetching posts:', err);
        return res.status(500).json({ error: 'An error occurred while fetching posts.' });
    }
}

export const getSinglePost = async (req, res) => {
    const { postId } = req.params;
    const postQuery = "SELECT posts.*, name, users.username, userImg, " +
        "(SELECT COUNT(likes.postId) FROM likes GROUP BY likes.postId HAVING likes.postId = ?) AS likes " +
        "FROM posts JOIN users ON posts.username = users.username WHERE posts.id = ?";

    try {
        // Fetch the post information
        const post = await queryDatabase(postQuery, [postId, postId]);

        if (!post.length) {
            return res.status(404).json({ error: 'Post not found.' });
        }

        // Fetch associated media for the post
        const mediaQuery = "SELECT * FROM posts_media WHERE post_id = ?";
        const mediaData = await queryDatabase(mediaQuery, [postId]);

        const postWithMedia = {
            ...post[0], // Assuming there's only one matching post
            media: mediaData,
        };

        return res.status(200).json(postWithMedia);
    } catch (err) {
        console.error('Error fetching post:', err);
        return res.status(500).json({ error: 'An error occurred while fetching the post.' });
    }
};

export const getUserPosts = async (req, res) => {
    const { username } = req.params;
    const q = "SELECT posts.*, name, users.username, users.userImg FROM posts JOIN users ON users.username = posts.username WHERE users.username = ? ORDER BY createdAt DESC;";

    try {
        const posts = await queryDatabase(q, [username]);
        const postIds = posts.map((post) => post.id);

        const mediaPromises = postIds.map((postId) => {
            const mediaQuery = `SELECT * FROM posts_media WHERE post_id = "${postId}"`;
            return queryDatabase(mediaQuery);
        });

        const mediaData = await Promise.all(mediaPromises);

        const postsWithMedia = posts.map((post, index) => ({
            ...post,
            media: mediaData[index],
        }));

        return res.status(200).json(postsWithMedia);
    } catch (err) {
        console.error('Error fetching posts:', err);
        return res.status(500).json({ error: 'An error occurred while fetching posts.' });
    }
};

export const createPost = async (req, res) => {
    const token = req.cookies.access_token;

    if (!token) {
        return res.status(401).json({ message: "You are not signed in!" });
    }

    jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, userInfo) => {
        if (err) {
            return res.status(403).json({ message: "Token is not valid!" });
        }

        const { text, gif } = req.body;
        const files = req.files;

        if (!(files.length || text || gif)) return res.status(403).json({ message: "Can't upload an empty post!" });


        try {
            const postId = uuidv4();
            const createdAt = dayjs(Date.now()).format("YYYY-MM-DD HH:mm:ss");

            // Insert the post into the database
            await insertPost(postId, text, createdAt, userInfo.username);

            if (gif) {
                await insertMedia(postId, gif, "post_gif");
            }

            // Handle media files (images and videos)
            if (files) {
                await handleMediaUpload(files, postId);
            }


            return res.status(200).json({
                status: 'success',
                message: 'Post has been uploaded!',
            });
        } catch (error) {
            console.error('Error creating post:', error);
            return res.status(500).json({ error: 'An error occurred while creating the post.' });
        }
    });
};


export const editPost = (req, res) => {
    const token = req.cookies.access_token;

    if (!token) return res.status(401).json({ message: "You are not Sign in!" });

    jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, userInfo) => {
        if (err) return res.status(403).json({ message: "Token is not valid!" });

        const { public_id, text } = req.body;
        const { postId } = req.params;
        const file = req.file;

        if (file) {
            const fileFormat = file.mimetype.split('/')[1];
            const uniqueFilename = `${uuidv4()}`;
            const { base64 } = bufferToDataURI(fileFormat, file.buffer);

            // Upload the image to Cloudinary
            const cloudinaryResponse = await cloudinary.uploader.upload(`data:image/${fileFormat};base64,${base64}`, {
                public_id: uniqueFilename,
            });

            if (public_id) {
                await cloudinary.uploader.destroy(public_id);
            };

            let q = "";

            if (fileFormat === 'gif') {
                q = "UPDATE posts SET postText=?, postGif=?, updatedAt=? WHERE id=?;";
            } else {
                q = "UPDATE posts SET postText=?, postImg=?, updatedAt=? WHERE id=?;";
            };

            const values = [
                text,
                cloudinaryResponse.secure_url,
                dayjs(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
                postId
            ];

            db.query(q, values, (err, data) => {
                if (err) return res.status(500).json(err);

                return res.status(200).json({
                    status: 'success',
                    message: 'Post has been updated!',
                });
            });
        };

        if (!file) {
            const q = "UPDATE posts SET postText=?, updatedAt=? WHERE id=?;";

            const values = [
                text,
                dayjs(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
                postId
            ];

            db.query(q, values, (err, data) => {
                if (err) return res.status(500).json(err);

                return res.status(200).json({
                    status: 'success',
                    message: 'Post has been updated!',
                });
            });
        }
    });
};

export const deletePost = (req, res) => {
    const token = req.cookies.access_token;

    if (!token) return res.status(401).json({ message: "You are not Sign in!" });

    jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, userInfo) => {
        if (err) return res.status(403).json({ message: "Token is not valid!" });

        const { public_id } = req.body;
        const { postId } = req.params;

        if (public_id) {
            await cloudinary.uploader.destroy(public_id);
        };

        const q = "DELETE FROM posts WHERE id=?;";

        db.query(q, [postId], (err, data) => {
            if (err) return res.status(500).json(err);

            return res.status(200).json({ message: "Post has been deleted!" });
        });
    });
};

export const addComment = (req, res) => {
    const token = req.cookies.access_token;

    if (!token) return res.status(401).json("You are not Sign in!");

    jwt.verify(token, process.env.JWT_SECRET_KEY, async (err, userInfo) => {
        if (err) return res.status(403).json("Token is not valid!");

        const { text, gif, parentId } = req.body;
        const { postId } = req.params;

        const parentID = parentId === 'undefined' ? null : parentId;

        const file = req.file;
        let uniqueFilename = null;
        if (!(postId || text)) return res.status(500).json({ message: 'error with postId or desc' });

        if (file) {
            const fileFormat = file.mimetype.split('/')[1];
            uniqueFilename = `${uuidv4()}`;
            const { base64 } = bufferToDataURI(fileFormat, file.buffer);
            // Upload the image to Cloudinary
            const cloudinaryResponse = await cloudinary.uploader.upload(`data:image/${fileFormat};base64,${base64}`, {
                public_id: uniqueFilename,
            });
            const q = "INSERT INTO comments(`id`, `userId`, `postId`, `parentId`, `commentImg`, `commentText`, `createdAt`) VALUES(?)";

            const values = [
                uuidv4(),
                userInfo.id,
                postId,
                parentID,
                cloudinaryResponse.secure_url,
                text,
                dayjs(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
            ];

            db.query(q, [values], async (err, data) => {
                if (err) return res.status(500).json(err);


                return res.status(200).json({
                    status: 'success',
                    message: 'Comment has been created!',
                    data: cloudinaryResponse,
                });
            })
            return;
        }

        const q = "INSERT INTO comments(`id`, `userId`, `postId`, `parentId`, `commentGif`, `commentText`, `createdAt`) VALUES(?)";

        const values = [
            uuidv4(),
            userInfo.id,
            postId,
            parentID,
            gif,
            text,
            dayjs(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
        ];

        db.query(q, [values], (err, data) => {
            if (err) return res.status(500).json(err);

            return res.status(200).json({
                status: 'success',
                message: 'Comment has been created!',
            });
        })
    })
}

export const getComments = (req, res) => {
    let q = "SELECT comments.*, users.userImg, users.name FROM comments LEFT JOIN posts ON posts.id = comments.postId LEFT JOIN users ON users.id = comments.userId WHERE comments.postId = ? ORDER BY createdAt DESC";

    db.query(q, [req.params.postId], (err, data) => {
        if (err) return res.status(500).json(err);

        return res.status(200).json(data);
    })
}

export const getComment = (req, res) => {
    let q = "SELECT comments.*, users.userImg, users.name FROM comments LEFT JOIN posts ON posts.id = comments.postId LEFT JOIN users ON users.id = comments.userId WHERE comments.parentId = ? ORDER BY createdAt DESC";

    db.query(q, [req.params.parentId], (err, data) => {
        if (err) return res.status(500).json(err);

        return res.status(200).json(data);
    })
}

export const deleteComment = (req, res) => {
    const { commentId } = req.body;
    let q = "DELETE FROM comments WHERE comments.id = ?";

    db.query(q, [commentId], (err, data) => {
        if (err) return res.status(500).json(err);

        return res.status(200).json(data);
    })
}

// Helper function to insert a post into the database
const insertPost = async (postId, text, createdAt, username) => {
    const q = "INSERT INTO posts(`id`, `postText`, `createdAt`, `username`) VALUES(?)";
    const values = [postId, text, createdAt, username];

    return new Promise((resolve, reject) => {
        db.query(q, [values], (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

// Helper function to handle media file uploads
const handleMediaUpload = async (files, postId) => {
    const mediaPromises = files.map(async (file) => {
        const fileFormat = file.mimetype.split('/')[1];
        const folder = fileFormat === 'gif' ? "gifs" : "photos";
        const uniqueFilename = uuidv4();

        if (file.mimetype.split('/')[0] === 'video') {
            const cloudinaryResponse = await cloudinary.uploader.upload_stream(
                { resource_type: 'video' },
                async (error, result) => {
                    if (error) {
                        console.error('Error uploading video:', error);
                    } else {
                        await insertMedia(postId, result.secure_url, "post_video");
                    }
                }
            ).end(file.buffer);
        } else {
            const { base64 } = bufferToDataURI(fileFormat, file.buffer);

            const cloudinaryResponse = await cloudinary.uploader.upload(
                `data:image/${fileFormat};base64,${base64}`,
                {
                    public_id: uniqueFilename,
                    folder: folder,
                }
            );

            const mediaType = fileFormat === 'gif' ? 'post_gif' : 'post_img';
            await insertMedia(postId, cloudinaryResponse.secure_url, mediaType);
        }
    });

    await Promise.all(mediaPromises);
};

// Helper function to insert media into the database
const insertMedia = async (postId, mediaUrl, mediaType = 'post_img') => {
    let q = "";

    if (mediaType === 'post_gif') {
        q = "INSERT INTO posts_media(`id`, `post_gif`, `post_id`) VALUES(?)";
    } else if (mediaType === "post_video") {
        q = "INSERT INTO posts_media(`id`, `post_video`, `post_id`) VALUES(?)";
    } else {
        q = "INSERT INTO posts_media(`id`, `post_img`, `post_id`) VALUES(?)";
    }

    const values = [uuidv4(), mediaUrl, postId];

    return new Promise((resolve, reject) => {
        db.query(q, [values], (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

// Helper function to execute a database query and return a promise
const queryDatabase = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.query(query, params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
};